import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { ScanService } from '../scan/scan.service';
import { SkillsService } from '../skills/skills.service';
import { SYSTEM_USER_ID } from './github-repo.config';
import * as matter from 'gray-matter';

interface BulkRepoConfig {
  owner: string;
  repo: string;
  basePath: string;
  category: string;
}

interface TokenInfo {
  token: string;
  remaining: number;
  resetAt: number;
  lastChecked: number;
}

@Injectable()
export class BulkDiscoveryService {
  private readonly logger = new Logger(BulkDiscoveryService.name);
  private bulkDiscovering = false;
  
  // Multi-token management
  private tokenPool: TokenInfo[] = [];
  private currentTokenIndex = 0;
  private allTokensExhausted = false;
  
  // Configuration for bulk repositories
  private readonly BULK_REPOS: BulkRepoConfig[] = [
    {
      owner: 'openclaw',
      repo: 'skills',
      basePath: 'skills',
      category: 'Openclaw Skills',
    },
  ];

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private scanService: ScanService,
    private skillsService: SkillsService,
  ) {
    this.initializeTokenPool();
  }

  private initializeTokenPool(): void {
    // Get GitHub tokens from environment variables
    const tokens = [
      process.env.GITHUB_TOKEN,
      process.env.GITHUB_TOKEN_2,
      process.env.GITHUB_TOKEN_3,
      process.env.GITHUB_TOKEN_4,
      process.env.GITHUB_TOKEN_5,
    ].filter(token => token && token.trim().length > 0);

    if (tokens.length === 0) {
      this.logger.warn('⚠️ No GitHub tokens configured! Discovery will be severely rate limited');
      return;
    }

    this.tokenPool = tokens.map(token => ({
      token: token!,
      remaining: 5000, // Default GitHub rate limit
      resetAt: Date.now() + 3600000, // 1 hour from now
      lastChecked: 0,
    }));

    this.logger.log(`🔑 Initialized GitHub token pool with ${this.tokenPool.length} tokens`);
  }

  private async getAvailableToken(): Promise<string | null> {
    if (this.tokenPool.length === 0) {
      return process.env.GITHUB_TOKEN || null;
    }

    const now = Date.now();

    // Check if any tokens have been reset
    for (const tokenInfo of this.tokenPool) {
      if (now > tokenInfo.resetAt) {
        tokenInfo.remaining = 5000;
        tokenInfo.resetAt = now + 3600000; // Reset to 1 hour from now
        this.logger.log(`🔄 Token reset detected, remaining: ${tokenInfo.remaining}`);
      }
    }

    // Try to find a token with remaining requests
    for (let i = 0; i < this.tokenPool.length; i++) {
      const tokenIndex = (this.currentTokenIndex + i) % this.tokenPool.length;
      const tokenInfo = this.tokenPool[tokenIndex];
      
      if (tokenInfo.remaining > 10) { // Keep some buffer
        this.currentTokenIndex = tokenIndex;
        return tokenInfo.token;
      }
    }

    // All tokens exhausted
    this.allTokensExhausted = true;
    this.logger.warn('🚫 All GitHub tokens exhausted!');
    return null;
  }

  private updateTokenInfo(token: string, remaining: number, resetAt: number): void {
    const tokenInfo = this.tokenPool.find(info => info.token === token);
    if (tokenInfo) {
      tokenInfo.remaining = remaining;
      tokenInfo.resetAt = resetAt * 1000; // Convert to milliseconds
      tokenInfo.lastChecked = Date.now();
      
      this.logger.debug(`📊 Token updated: ${remaining} remaining, resets at ${new Date(tokenInfo.resetAt)}`);
    }
  }

  private async waitForTokenReset(): Promise<void> {
    if (this.tokenPool.length === 0) {
      // No token pool, wait default time
      const waitTime = 30 * 60 * 1000; // 30 minutes
      this.logger.warn(`⏰ Waiting ${waitTime / 60000} minutes for rate limit reset...`);
      await this.sleep(waitTime);
      return;
    }

    // Find the earliest reset time
    const now = Date.now();
    const resetTimes = this.tokenPool
      .map(info => info.resetAt)
      .filter(resetAt => resetAt > now)
      .sort((a, b) => a - b);

    if (resetTimes.length === 0) {
      // All tokens should be reset, wait a short time
      this.logger.log('🔄 All tokens should be reset, waiting 1 minute...');
      await this.sleep(60000);
      this.allTokensExhausted = false;
      return;
    }

    const earliestReset = resetTimes[0];
    const waitTime = Math.min(
      earliestReset - now + 60000, // Add 1 minute buffer
      30 * 60 * 1000 // Maximum 30 minutes
    );

    this.logger.warn(`⏰ Waiting ${Math.ceil(waitTime / 60000)} minutes for next token reset...`);
    await this.sleep(waitTime);
    this.allTokensExhausted = false;
  }

  private logTokenStatus(): void {
    if (this.tokenPool.length === 0) {
      this.logger.log('🔑 No token pool configured');
      return;
    }

    const now = Date.now();
    const activeTokens = this.tokenPool.filter(info => info.remaining > 10);
    const exhaustedTokens = this.tokenPool.filter(info => info.remaining <= 10 && info.resetAt > now);
    
    this.logger.log(`🔑 Token Status: ${activeTokens.length} active, ${exhaustedTokens.length} exhausted`);
    
    if (activeTokens.length > 0) {
      const totalRemaining = activeTokens.reduce((sum, info) => sum + info.remaining, 0);
      this.logger.log(`📊 Total remaining requests: ${totalRemaining}`);
    }
  }

  /** Run daily at 3 AM to avoid conflicts with other discovery services */
  @Cron('0 3 * * *')
  async handleBulkDiscoveryCron() {
    // await this.discoverAllBulkRepos();
  }

  async discoverAllBulkRepos() {
    if (this.bulkDiscovering) {
      this.logger.warn('Bulk discovery already in progress, skipping');
      return;
    }

    this.bulkDiscovering = true;
    this.logger.log('🚀 Starting bulk skill discovery for large repositories...');

    let totalDiscovered = 0;

    try {
      for (const repoConfig of this.BULK_REPOS) {
        try {
          const count = await this.discoverBulkRepo(repoConfig);
          totalDiscovered += count;
        } catch (error) {
          this.logger.error(`Failed to discover bulk repo ${repoConfig.owner}/${repoConfig.repo}: ${error.message}`);
        }
      }
    } finally {
      this.bulkDiscovering = false;
      this.logger.log(`✅ Bulk discovery completed. Discovered ${totalDiscovered} new skills.`);
      
      if (totalDiscovered > 0) {
        this.skillsService.clearSkillsCache();
      }
    }
  }

  private async discoverBulkRepo(config: BulkRepoConfig): Promise<number> {
    const { owner, repo, basePath, category } = config;
    const repoFullName = `${owner}/${repo}`;
    this.logger.log(`🔍 Bulk discovering: ${repoFullName}/${basePath}`);

    let discoveredCount = 0;

    try {
      // First, get all directories in the base path (e.g., all user directories in skills/)
      const userDirs = await this.fetchDirectoriesInPath(owner, repo, basePath);
      this.logger.log(`Found ${userDirs.length} user directories in ${repoFullName}/${basePath}`);

      // Process each user directory to find their skills
      for (let i = 0; i < userDirs.length; i++) {
        const userDir = userDirs[i];
        try {
          const userSkillCount = await this.processUserDirectory(config, userDir);
          discoveredCount += userSkillCount;
          
          // Log progress every 50 users
          if ((i + 1) % 50 === 0) {
            const progress = ((i + 1) / userDirs.length * 100).toFixed(1);
            this.logger.log(`📊 Progress: ${i + 1}/${userDirs.length} (${progress}%) | Discovered ${discoveredCount} skills`);
            
            // Show token status
            this.logTokenStatus();
          }
          
          // Smart rate limiting - only delay if we're making many API calls
          // For small delays, just continue; for rate limit concerns, the token management handles it
          if (i % 10 === 0) { // Every 10 users, small pause
            await this.sleep(100);
          }
        } catch (error) {
          this.logger.warn(`Failed to process user directory ${userDir.path}: ${error.message}`);
        }
      }

      this.logger.log(`🎉 Discovered ${discoveredCount} skills from ${repoFullName}`);
      return discoveredCount;
    } catch (error) {
      this.logger.error(`Error during bulk discovery of ${repoFullName}: ${error.message}`);
      return 0;
    }
  }

  private async processUserDirectory(config: BulkRepoConfig, userDir: any): Promise<number> {
    const { owner, repo, category } = config;
    let skillCount = 0;

    try {
      // Get all items in user directory (could be skill directories or files)
      const items = await this.fetchContentsInPath(owner, repo, userDir.path);
      
      // Check if SKILL.md exists directly in user directory
      const directSkillMd = items.find(item => 
        item.type === 'file' && item.name.toLowerCase() === 'skill.md'
      );

      if (directSkillMd) {
        // User directory contains SKILL.md directly
        const success = await this.createSkillFromFile(config, directSkillMd, userDir.path);
        if (success) skillCount++;
      } else {
        // Check subdirectories for SKILL.md files
        const subdirs = items.filter(item => item.type === 'dir');
        
        for (const subdir of subdirs) {
          try {
            const subdirItems = await this.fetchContentsInPath(owner, repo, subdir.path);
            const skillMdFile = subdirItems.find(item => 
              item.type === 'file' && item.name.toLowerCase() === 'skill.md'
            );

            if (skillMdFile) {
              const success = await this.createSkillFromFile(config, skillMdFile, subdir.path);
              if (success) skillCount++;
            }
          } catch (error) {
            this.logger.debug(`Skipping subdirectory ${subdir.path}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error processing user directory ${userDir.path}: ${error.message}`);
    }

    return skillCount;
  }

  private async createSkillFromFile(config: BulkRepoConfig, skillMdFile: any, skillPath: string): Promise<boolean> {
    const { owner, repo, category } = config;
    const repoFullName = `${owner}/${repo}`;

    try {
      // Check if skill already exists
      const existingSkill = await this.prisma.skill.findFirst({
        where: {
          sourceRepo: repoFullName,
          sourcePath: skillPath,
        },
      });

      if (existingSkill) {
        this.logger.debug(`Skill already exists: ${skillPath}`);
        return false;
      }

      // Fetch SKILL.md content
      const skillMdContent = await this.fetchRawUrl(skillMdFile.download_url);
      if (!skillMdContent) {
        this.logger.warn(`Failed to fetch SKILL.md from ${skillMdFile.download_url}`);
        return false;
      }

      // Parse metadata
      const { name, description } = this.parseSkillMetadata(skillMdContent, skillPath);
      
      if (!description || description.length < 10) {
        this.logger.warn(`Skipping ${skillPath}: no meaningful description`);
        return false;
      }

      // Get repository metadata for stars, etc.
      const repoMeta = await this.fetchRepoMetadata(owner, repo);

      // Upload to S3
      const fileName = skillMdFile.name;
      const s3Key = `skills/bulk-discovery/${owner}-${repo}/${skillPath}/${fileName}`;
      const fileBuffer = Buffer.from(skillMdContent, 'utf-8');
      
      await this.s3Service.uploadFile(fileBuffer, s3Key, 'text/markdown', {
        originalName: fileName,
        skillName: name,
        sourceRepo: repoFullName,
        sourcePath: skillPath,
      });

      // Create skill record
      const skill = await this.prisma.$transaction(async (tx) => {
        const createdSkill = await tx.skill.create({
          data: {
            userId: SYSTEM_USER_ID,
            name: name,
            description: description.slice(0, 2000),
            filePath: s3Key,
            fileSize: fileBuffer.length,
            category: category,
            sourceRepo: repoFullName,
            sourcePath: skillPath,
            stars: repoMeta?.stargazers_count || 0,
            language: repoMeta?.language,
            topics: JSON.stringify(repoMeta?.topics || []),
            repoUrl: repoMeta?.html_url || `https://github.com/${repoFullName}`,
            authorName: repoMeta?.owner?.login || owner,
            authorAvatar: repoMeta?.owner?.avatar_url || null,
            lastCommitAt: repoMeta?.pushed_at ? new Date(repoMeta.pushed_at) : null,
          },
        });

        // Create scan result
        await tx.scanResult.create({
          data: {
            skillId: createdSkill.id,
            status: 'PENDING',
            scanSummary: 'Bulk discovery skill - security scan pending',
          },
        });

        return createdSkill;
      });

      this.logger.debug(`✅ Created skill: ${name} (${skillPath})`);

      // Trigger security scan
      const defaultBranch = repoMeta?.default_branch || 'main';
      const rawSkillMdUrl = `https://raw.githubusercontent.com/${repoFullName}/${defaultBranch}/${skillMdFile.path}`;
      setImmediate(() => this.scanService.triggerScanByUrl(skill.id, rawSkillMdUrl, 'raw'));

      return true;
    } catch (error) {
      this.logger.error(`Error creating skill from ${skillPath}: ${error.message}`);
      return false;
    }
  }

  private parseSkillMetadata(skillMdContent: string, skillPath: string): { name: string; description: string } {
    // Extract skill name from path (last directory)
    const pathParts = skillPath.split('/');
    const defaultName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || 'Unknown Skill';
    
    let name = defaultName;
    let description = '';

    try {
      const { data: frontmatter, content: markdownBody } = matter(skillMdContent);
      name = frontmatter.displayName || frontmatter.name || name;
      description = frontmatter.description || markdownBody.slice(0, 2000) || '';
    } catch (error) {
      this.logger.debug(`Error parsing frontmatter for ${skillPath}: ${error.message}`);
      // Fallback: extract from markdown content
      const lines = skillMdContent.split('\n').filter(line => line.trim());
      const descLines = lines.slice(0, 5).filter(line => 
        !line.startsWith('#') && 
        !line.startsWith('---') && 
        line.trim().length > 10
      );
      description = descLines.join(' ').slice(0, 2000);
    }

    return { name, description };
  }

  // GitHub API helper methods
  private async fetchDirectoriesInPath(owner: string, repo: string, path: string): Promise<any[]> {
    const contents = await this.fetchContentsInPath(owner, repo, path);
    return contents.filter(item => item.type === 'dir');
  }

  private async fetchContentsInPath(owner: string, repo: string, path: string): Promise<any[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const data = await this.fetchGitHubApiWithRateLimit(url);
    return Array.isArray(data) ? data : [];
  }

  private async fetchGitHubApiWithRateLimit(url: string, retryCount = 0): Promise<any> {
    // Check if all tokens are exhausted and wait if necessary
    while (this.allTokensExhausted) {
      this.logger.warn('⏸️ All tokens exhausted, waiting for reset...');
      await this.waitForTokenReset();
    }

    const token = await this.getAvailableToken();
    if (!token) {
      this.logger.error('❌ No available GitHub token found!');
      throw new Error('No available GitHub token');
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-BulkBot',
      Authorization: `Bearer ${token}`,
    };

    try {
      const res = await fetch(url, { headers });
      
      // Update token info from rate limit headers
      const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
      const reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0');
      
      if (remaining !== undefined && reset !== undefined) {
        this.updateTokenInfo(token, remaining, reset);
      }

      this.logger.debug(`🔍 API call: ${url.split('/').slice(-2).join('/')} | Remaining: ${remaining}`);

      // Handle rate limit responses
      if (res.status === 403) {
        const rateLimitError = res.headers.get('X-RateLimit-Remaining') === '0';
        
        if (rateLimitError) {
          this.logger.warn(`🚫 Token rate limited (${remaining} remaining)`);
          
          // Mark this token as exhausted
          this.updateTokenInfo(token, 0, reset);
          
          // Try with next available token
          const nextToken = await this.getAvailableToken();
          if (nextToken && retryCount < 3) {
            this.logger.log('🔄 Switching to next available token...');
            return this.fetchGitHubApiWithRateLimit(url, retryCount + 1);
          }
          
          // All tokens exhausted
          this.logger.warn('🚫 All tokens rate limited, waiting for reset...');
          await this.waitForTokenReset();
          return this.fetchGitHubApiWithRateLimit(url, 0); // Reset retry count
        }
        
        throw new Error(`GitHub API error 403: ${url}`);
      }

      if (!res.ok) {
        if (retryCount < 3) {
          const backoffTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
          this.logger.warn(`⚠️ API error ${res.status}, retrying in ${backoffTime}ms...`);
          await this.sleep(backoffTime);
          return this.fetchGitHubApiWithRateLimit(url, retryCount + 1);
        }
        throw new Error(`GitHub API error ${res.status}: ${url}`);
      }
      
      return res.json();
    } catch (error) {
      if (retryCount < 3) {
        const backoffTime = Math.pow(2, retryCount) * 5000;
        this.logger.warn(`🔄 Request failed, retrying in ${backoffTime}ms: ${error.message}`);
        await this.sleep(backoffTime);
        return this.fetchGitHubApiWithRateLimit(url, retryCount + 1);
      }
      throw error;
    }
  }

  private async fetchRawUrl(url: string): Promise<string | null> {
    const token = await this.getAvailableToken();
    const headers: Record<string, string> = {
      'User-Agent': 'SafuSkill-BulkBot',
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { headers });
      
      // Update token info if we have rate limit headers
      if (token && res.headers.get('X-RateLimit-Remaining')) {
        const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
        const reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0');
        this.updateTokenInfo(token, remaining, reset);
      }
      
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Manual trigger methods for testing/immediate execution
  async triggerBulkDiscovery(): Promise<void> {
    this.logger.log('🔧 Manual bulk discovery triggered');
    await this.discoverAllBulkRepos();
  }

  async discoverSingleRepo(owner: string, repo: string, basePath: string, category: string): Promise<number> {
    this.logger.log(`🎯 Single repo discovery: ${owner}/${repo}/${basePath}`);
    const config: BulkRepoConfig = { owner, repo, basePath, category };
    return await this.discoverBulkRepo(config);
  }
}