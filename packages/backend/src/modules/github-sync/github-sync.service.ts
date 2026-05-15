import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { ScanService } from '../scan/scan.service';
import { SkillsService } from '../skills/skills.service';
import { GITHUB_REPOS, SYSTEM_USER_ID, RepoConfig } from './github-repo.config';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import * as matter from 'gray-matter';

interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
}

@Injectable()
export class GithubSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GithubSyncService.name);
  private syncing = false;

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private scanService: ScanService,
    private skillsService: SkillsService,
  ) {}

  async onApplicationBootstrap() {
    // Initial sync after a short delay to let the app fully start
    // setTimeout(() => this.syncAll(), 5000);
  }

  @Cron('0 */6 * * *')
  async handleCron() {
    await this.syncAll();
  }

  async syncAll() {
    if (this.syncing) {
      this.logger.warn('Sync already in progress, skipping');
      return;
    }

    this.syncing = true;
    this.logger.log('Starting GitHub skills sync...');

    try {
      for (const repoConfig of GITHUB_REPOS) {
        try {
          await this.syncRepo(repoConfig);
        } catch (err) {
          this.logger.error(`Failed to sync repo ${repoConfig.owner}/${repoConfig.repo}: ${err.message}`);
        }
      }
    } finally {
      this.syncing = false;
      this.logger.log('GitHub skills sync completed');
    }
  }

  private async syncRepo(config: RepoConfig) {
    const repoFullName = `${config.owner}/${config.repo}`;
    this.logger.log(`Syncing repo: ${repoFullName} (${config.structure})`);

    const skillDirs = await this.discoverSkillDirs(config);
    this.logger.log(`Found ${skillDirs.length} skill(s) in ${repoFullName}`);

    for (const skillDir of skillDirs) {
      try {
        await this.syncSkill(config, skillDir);
      } catch (err) {
        this.logger.error(`Failed to sync skill ${skillDir.path}: ${err.message}`);
      }
    }
  }

  private async discoverSkillDirs(config: RepoConfig): Promise<GitHubContentItem[]> {
    const topLevel = await this.fetchGitHubContents(config.owner, config.repo, 'skills');
    const dirs = topLevel.filter((item) => item.type === 'dir');

    if (config.structure === 'flat') {
      return dirs;
    }

    // Nested: skills/<provider>/<skill>/ — go one level deeper
    const allSkillDirs: GitHubContentItem[] = [];
    for (const providerDir of dirs) {
      const skillDirs = await this.fetchGitHubContents(config.owner, config.repo, providerDir.path);
      allSkillDirs.push(...skillDirs.filter((item) => item.type === 'dir'));
    }
    return allSkillDirs;
  }

  private async syncSkill(config: RepoConfig, skillDir: GitHubContentItem) {
    const repoFullName = `${config.owner}/${config.repo}`;

    // Fetch SKILL.md content and upload to S3
    const skillMdContent = await this.fetchSkillMdContent(config.owner, config.repo, skillDir.path);
    if (!skillMdContent) {
      this.logger.warn(`No SKILL.md found for ${repoFullName}:${skillDir.path}, skipping...`);
      return;
    }

    // Parse frontmatter
    const { data: frontmatter, content: markdownBody } = matter(skillMdContent);
    const skillName = frontmatter.displayName || frontmatter.name || skillDir.name;
    const description = frontmatter.description || markdownBody.slice(0, 500) || '';

    // Fetch repo metadata for stars, language, etc.
    const repoMeta = await this.fetchRepoMetadata(config.owner, config.repo);

    // Check if skill already exists
    const existing = await this.prisma.skill.findFirst({
      where: {
        sourceRepo: repoFullName,
        sourcePath: skillDir.path,
      },
    });

    // Upload SKILL.md to S3 (similar to GitHub URL upload)
    const fileName = `${skillName}.md`;
    const s3Key = `skills/github-sync/${config.owner}-${config.repo}/${skillDir.path}/${fileName}`;
    const fileBuffer = Buffer.from(skillMdContent, 'utf-8');
    await this.s3Service.uploadFile(fileBuffer, s3Key, 'text/markdown', {
      originalName: fileName,
      skillName: skillName,
      sourceRepo: repoFullName,
      sourcePath: skillDir.path,
    });
    const fileSize = fileBuffer.length;

    const metaFields = repoMeta
      ? {
          stars: repoMeta.stargazers_count,
          language: repoMeta.language,
          topics: JSON.stringify(repoMeta.topics || []),
          repoUrl: repoMeta.html_url,
          authorName: repoMeta.owner?.login,
          authorAvatar: repoMeta.owner?.avatar_url,
          lastCommitAt: repoMeta.pushed_at ? new Date(repoMeta.pushed_at) : undefined,
        }
      : {};

    if (existing) {
      // Update existing skill
      await this.prisma.skill.update({
        where: { id: existing.id },
        data: {
          name: skillName,
          description: String(description).slice(0, 2000),
          filePath: s3Key,
          fileSize: fileSize,
          ...metaFields,
        },
      });
      this.logger.log(`Updated skill: ${skillName} (${skillDir.path})`);
      
      // Clear skills cache since skill was updated
      this.skillsService.clearSkillsCache();
    } else {
      // Create new skill
      const skill = await this.prisma.skill.create({
        data: {
          userId: SYSTEM_USER_ID,
          name: skillName,
          description: String(description).slice(0, 2000),
          filePath: s3Key,
          fileSize: fileSize,
          category: config.category,
          sourceRepo: repoFullName,
          sourcePath: skillDir.path,
          ...metaFields,
        },
      });
      this.logger.log(`Created new skill: ${skillName} (${skillDir.path})`);

      // Create initial scan result with PENDING status
      await this.prisma.scanResult.create({
        data: {
          skillId: skill.id,
          status: 'PENDING',
          scanSummary: 'GitHub sync skill - security scan pending',
        },
      });

      // Trigger security scan using raw GitHub URL with type="raw"
      const defaultBranch = repoMeta?.default_branch || 'main';
      const rawSkillMdUrl = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${defaultBranch}/${skillDir.path}/SKILL.md`;
      setImmediate(() => this.scanService.triggerScanByUrl(skill.id, rawSkillMdUrl, 'raw'));
      
      // Clear skills cache since new skill was created
      this.skillsService.clearSkillsCache();
    }
  }

  private async fetchGitHubApiWithRateLimit(url: string, retryCount = 0): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    
    // Check rate limit headers
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
    const reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0');
    
    this.logger.debug(`Rate limit: ${remaining} remaining`);
    
    // Enhanced rate limiting with exponential backoff
    if (remaining < 10) { // RATE_LIMIT_THRESHOLD equivalent
      const now = Math.floor(Date.now() / 1000);
      const waitTime = Math.max(reset - now, 0) * 1000;
      this.logger.warn(`Low rate limit (${remaining}), pausing for ${waitTime}ms`);
      await this.sleep(waitTime + 1000); // Add 1s buffer
    }

    if (!res.ok) {
      if (res.status === 403 && retryCount < 3) {
        // Exponential backoff for rate limit errors
        const backoffTime = Math.pow(2, retryCount) * 30000; // 30s, 60s, 120s
        this.logger.warn(`Rate limit hit, retrying in ${backoffTime}ms (attempt ${retryCount + 1}/3)`);
        await this.sleep(backoffTime);
        return this.fetchGitHubApiWithRateLimit(url, retryCount + 1);
      }
      throw new Error(`GitHub API error ${res.status}: ${url}`);
    }
    
    return res.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchRepoMetadata(owner: string, repo: string): Promise<any | null> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      const data = await this.fetchGitHubApiWithRateLimit(url);
      return data;
    } catch {
      return null;
    }
  }

  private async fetchSkillMdContent(owner: string, repo: string, skillPath: string): Promise<string | null> {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${skillPath}/SKILL.md`;
      const headers: Record<string, string> = {
        'User-Agent': 'SafuSkill-Bot',
      };

      const token = process.env.GITHUB_TOKEN;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }

  private async fetchGitHubContents(owner: string, repo: string, contentPath: string): Promise<GitHubContentItem[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`;

    try {
      const data = await this.fetchGitHubApiWithRateLimit(url);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  private async fetchRawFile(owner: string, repo: string, filePath: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
    return this.fetchRawUrl(url);
  }

  private async fetchRawUrl(url: string): Promise<string | null> {
    const headers: Record<string, string> = {
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
}
