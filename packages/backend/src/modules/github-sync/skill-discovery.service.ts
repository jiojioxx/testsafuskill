import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { ScanService } from '../scan/scan.service';
import { SkillsService } from '../skills/skills.service';
import { SYSTEM_USER_ID } from './github-repo.config';
import { PlatformDetectorService } from '../ranking/platform-detector.service';
import { QualityAnalyzerService } from '../ranking/quality-analyzer.service';
import {
  CORE_QUERIES,
  EXTENDED_QUERIES,
  TOPIC_QUERIES,
  FILENAME_QUERIES,
  MIN_STARS,
  MAX_PAGES,
  PER_PAGE,
  SEARCH_DELAY_MS,
  CONCURRENCY_LIMIT,
  RATE_LIMIT_THRESHOLD,
  RATE_LIMIT_PAUSE_MS,
  CATEGORY_RULES,
  DEFAULT_CATEGORY,
} from './discovery-queries.config';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import * as matter from 'gray-matter';

interface GitHubSearchResult {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  fork: boolean;
  archived: boolean;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchResult[];
}

@Injectable()
export class SkillDiscoveryService {
  private readonly logger = new Logger(SkillDiscoveryService.name);
  private discovering = false;
  
  // Repository deduplication map
  private discoveredRepos = new Map<string, GitHubSearchResult>();

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private scanService: ScanService,
    private skillsService: SkillsService,
    @Optional() private platformDetector?: PlatformDetectorService,
    @Optional() private qualityAnalyzer?: QualityAnalyzerService,
  ) {}

  async onApplicationBootstrap() {
    // Run first discovery 30s after startup (avoid conflict with syncAll)
    // setTimeout(() => this.discoverAll(), 30000);
  }

  /** Run every 12 hours */
  @Cron('0 1 */12 * * *')
  async handleDiscoveryCron() {
    await this.discoverAll();
  }

  async discoverAll() {
    if (this.discovering) {
      this.logger.warn('Discovery already in progress, skipping');
      return;
    }

    this.discovering = true;
    this.logger.log('Starting enhanced multi-layer skill discovery...');
    
    // Clear deduplication map for fresh discovery
    this.discoveredRepos.clear();
    let totalDiscovered = 0;
    let processedCount = 0;

    try {
      // Determine if we should run extended queries (weekly, on Sundays)
      const isWeekly = new Date().getDay() === 0;
      
      // Layer 1: Repository keyword search
      this.logger.log('🔍 Layer 1: Repository keyword search');
      const repositoryQueries = isWeekly
        ? [...CORE_QUERIES, ...EXTENDED_QUERIES]
        : CORE_QUERIES;
      
      for (const query of repositoryQueries) {
        try {
          await this.searchRepositoriesByKeyword(query);
        } catch (err) {
          this.logger.error(`Repository search failed for query "${query}": ${err.message}`);
        }
      }

      // Layer 2: Topic-based search (weekly only)
      if (isWeekly) {
        this.logger.log('🏷️ Layer 2: Topic-based search');
        for (const query of TOPIC_QUERIES) {
          try {
            await this.searchRepositoriesByTopic(query);
          } catch (err) {
            this.logger.error(`Topic search failed for query "${query}": ${err.message}`);
          }
        }

        // Layer 3: Filename-based code search (weekly only)
        this.logger.log('📄 Layer 3: Filename-based code search');
        for (const query of FILENAME_QUERIES) {
          try {
            await this.searchRepositoriesByFilename(query);
          } catch (err) {
            this.logger.error(`Filename search failed for query "${query}": ${err.message}`);
          }
        }
      }

      // Index all discovered repositories with database deduplication check
      this.logger.log(`🔧 Processing ${this.discoveredRepos.size} unique repositories`);
      const repos = Array.from(this.discoveredRepos.values());
      
      for (const repo of repos) {
        try {
          const indexed = await this.indexRepo(repo);
          if (indexed) {
            totalDiscovered++;
          }
          processedCount++;
          
          // Prevent memory buildup during large discovery runs
          if (processedCount % 100 === 0) {
            this.logger.log(`Progress: ${processedCount}/${repos.length} repositories processed, ${totalDiscovered} skills created`);
            // Force garbage collection hint for memory management
            if (global.gc) {
              global.gc();
            }
          }
        } catch (err) {
          this.logger.error(`Failed to index ${repo.full_name}: ${err.message}`);
          processedCount++;
        }
      }

      // Also index approved community submissions
      let submissionProcessed = 0;
      try {
        const approved = await this.prisma.skillSubmission.findMany({
          where: { status: 'APPROVED' },
        });
        for (const sub of approved) {
          const match = sub.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
          if (!match) continue;
          const [owner, repo] = match[1].split('/');
          const existing = await this.prisma.skill.findFirst({
            where: { sourceRepo: match[1] },
          });
          if (existing) continue;

          try {
            const repoData = await this.fetchGitHubApiWithRateLimit(
              `https://api.github.com/repos/${owner}/${repo}`,
            ) as GitHubSearchResult;
            if (repoData) {
              const indexed = await this.indexRepo(repoData);
              if (indexed) totalDiscovered++;
              submissionProcessed++;
            }
          } catch (err) {
            this.logger.error(`Failed to index submitted repo ${sub.repoUrl}: ${err.message}`);
            submissionProcessed++;
          }
        }
        if (submissionProcessed > 0) {
          this.logger.log(`📋 Processed ${submissionProcessed} approved community submissions`);
        }
      } catch (err) {
        this.logger.error(`Failed to process submissions: ${err.message}`);
      }
    } finally {
      this.discovering = false;
      this.logger.log(`✅ Enhanced discovery completed. Discovered ${totalDiscovered} new skill(s) from ${processedCount}/${this.discoveredRepos.size} processed repositories.`);
      
      // Clear skills cache if any new skills were discovered
      if (totalDiscovered > 0) {
        this.skillsService.clearSkillsCache();
      }
      
      this.discoveredRepos.clear();
    }
  }

  // ── Enhanced GitHub Search Methods ──

  /**
   * Layer 1: Repository keyword search
   */
  private async searchRepositoriesByKeyword(query: string): Promise<void> {
    this.logger.debug(`🔍 Repository search: "${query}"`);

    for (let page = 1; page <= MAX_PAGES; page++) {
      const results = await this.searchGitHub(query, page, 'repository');
      if (!results || results.items.length === 0) break;

      let added = 0;
      for (const repo of results.items) {
        if (this.addRepositoryToDiscovered(repo)) {
          added++;
        }
      }

      this.logger.debug(`Query "${query}" page ${page}: ${added}/${results.items.length} new repos`);
      
      // Rate limit protection
      await this.sleep(SEARCH_DELAY_MS);
    }
  }

  /**
   * Layer 2: Topic-based search
   */
  private async searchRepositoriesByTopic(query: string): Promise<void> {
    this.logger.debug(`🏷️ Topic search: "${query}"`);

    for (let page = 1; page <= MAX_PAGES; page++) {
      const results = await this.searchGitHub(query, page, 'repository');
      if (!results || results.items.length === 0) break;

      let added = 0;
      for (const repo of results.items) {
        if (this.addRepositoryToDiscovered(repo)) {
          added++;
        }
      }

      this.logger.debug(`Query "${query}" page ${page}: ${added}/${results.items.length} new repos`);
      
      await this.sleep(SEARCH_DELAY_MS);
    }
  }

  /**
   * Layer 3: Filename-based code search 
   */
  private async searchRepositoriesByFilename(query: string): Promise<void> {
    this.logger.debug(`📄 Filename search: "${query}"`);

    for (let page = 1; page <= MAX_PAGES; page++) {
      const results = await this.searchGitHubCode(query, page);
      if (!results || results.items.length === 0) break;

      let added = 0;
      // Extract repository info from code search results
      for (const codeItem of results.items) {
        if (codeItem.repository) {
          const repo: GitHubSearchResult = {
            full_name: codeItem.repository.full_name,
            name: codeItem.repository.name,
            description: codeItem.repository.description,
            html_url: codeItem.repository.html_url,
            stargazers_count: codeItem.repository.stargazers_count || 0,
            language: codeItem.repository.language,
            topics: codeItem.repository.topics || [],
            fork: codeItem.repository.fork || false,
            archived: codeItem.repository.archived || false,
            pushed_at: codeItem.repository.pushed_at,
            owner: {
              login: codeItem.repository.owner.login,
              avatar_url: codeItem.repository.owner.avatar_url,
            },
          };

          if (this.addRepositoryToDiscovered(repo)) {
            added++;
          }
        }
      }

      this.logger.debug(`Query "${query}" page ${page}: ${added}/${results.items.length} new repos`);
      
      await this.sleep(SEARCH_DELAY_MS);
    }
  }

  /**
   * Add repository to discovered set with deduplication and minimal filtering
   */
  private addRepositoryToDiscovered(repo: GitHubSearchResult): boolean {
    // Skip if already discovered
    if (this.discoveredRepos.has(repo.full_name)) {
      return false;
    }

    // Only filter by minimum stars (now 0, so effectively no filtering)
    if (repo.stargazers_count < MIN_STARS) {
      return false;
    }

    // Remove fork and archived filtering to discover all SKILL.md files
    // Note: We'll index all repositories that might contain SKILL.md
    
    this.discoveredRepos.set(repo.full_name, repo);
    return true;
  }

  /**
   * Enhanced GitHub code search for filename-based queries
   */
  private async searchGitHubCode(query: string, page: number): Promise<any | null> {
    const q = encodeURIComponent(query);
    const url = `https://api.github.com/search/code?q=${q}&sort=indexed&order=desc&per_page=${PER_PAGE}&page=${page}`;

    try {
      const data = await this.fetchGitHubApiWithRateLimit(url);
      return data;
    } catch (err) {
      if (err.message?.includes('403')) {
        this.logger.warn('GitHub Code Search API rate limited, waiting...');
        await this.sleep(RATE_LIMIT_PAUSE_MS);
        return this.searchGitHubCode(query, page);
      }
      throw err;
    }
  }

  /**
   * Recursively find all SKILL.md files in a GitHub repository
   */
  private async findAllSkillMdFiles(
    owner: string, 
    repo: string, 
    dirPath: string = '', 
    depth: number = 0
  ): Promise<Array<{ path: string; download_url: string; dirPath: string; fileName: string }>> {
    // Prevent infinite recursion - limit depth to 5 levels for performance
    if (depth > 5) {
      this.logger.warn(`Max depth reached (${depth}) for ${owner}/${repo}:${dirPath}`);
      return [];
    }

    this.logger.debug(`Searching for SKILL.md in ${owner}/${repo}:${dirPath} (depth: ${depth})`);

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
      
      // Use rate-limited API call with retry mechanism
      const data = await this.fetchGitHubApiWithRateLimit(url);
      const items = Array.isArray(data) ? data : [];
      this.logger.debug(`Found ${items.length} items in ${owner}/${repo}:${dirPath}`);
      
      const allSkillMdFiles: Array<{ path: string; download_url: string; dirPath: string; fileName: string }> = [];

      // Check if SKILL.md exists in current directory
      const skillMdFile = items.find((item: any) => 
        item.type === 'file' && 
        item.name.toLowerCase() === 'skill.md'
      );

      if (skillMdFile && skillMdFile.download_url) {
        this.logger.log(`📄 Found SKILL.md at ${skillMdFile.path}`);
        allSkillMdFiles.push({
          path: skillMdFile.path,
          download_url: skillMdFile.download_url,
          dirPath: dirPath,
          fileName: skillMdFile.name
        });
      }

      // Recursively search in subdirectories (but limit to avoid huge repos)
      const directories = items.filter((item: any) => item.type === 'dir');
      this.logger.debug(`Found ${directories.length} directories in ${owner}/${repo}:${dirPath}`);
      
      // For performance: limit directory search on large repos
      if (directories.length > 50 && depth === 0) {
        this.logger.warn(`Large repo detected (${directories.length} dirs), limiting search to common skill directories`);
        const commonSkillDirs = ['skills', 'skill', 'src', 'packages', 'apps', 'tools', 'examples'];
        const filteredDirs = directories.filter(dir => 
          commonSkillDirs.some(common => 
            dir.name.toLowerCase().includes(common) || 
            common.includes(dir.name.toLowerCase())
          )
        );
        this.logger.log(`Filtered to ${filteredDirs.length} potential skill directories`);
        directories.splice(0, directories.length, ...filteredDirs);
      }

      for (const dir of directories) {
        // Skip common directories that are unlikely to contain SKILL.md
        const skipDirs = ['.git', 'node_modules', '.github', 'dist', 'build', '__pycache__', '.vscode', '.idea', 'coverage', 'docs', 'test', 'tests', '.next', 'out'];
        if (skipDirs.some(skipDir => dir.name.toLowerCase().includes(skipDir))) {
          continue;
        }

        this.logger.debug(`Searching subdirectory: ${dir.path}`);
        const subResults = await this.findAllSkillMdFiles(owner, repo, dir.path, depth + 1);
        allSkillMdFiles.push(...subResults);
        
        // Add small delay to avoid overwhelming GitHub API
        await this.sleep(100);
      }

      this.logger.debug(`Completed search in ${owner}/${repo}:${dirPath}, found ${allSkillMdFiles.length} SKILL.md files`);
      return allSkillMdFiles;
    } catch (error) {
      // Handle 404 (path not found) separately from other errors
      if (error.message?.includes('404')) {
        this.logger.debug(`Path not found: ${owner}/${repo}:${dirPath}`);
        return []; // Path doesn't exist, that's ok
      }
      
      this.logger.error(`Error searching for SKILL.md in ${owner}/${repo}:${dirPath}:`, error);
      return []; // For other errors, return empty to continue processing
    }
  }

  private async indexRepo(repo: GitHubSearchResult): Promise<boolean> {
    const { full_name, name } = repo;
    const [owner, repoName] = full_name.split('/');
    this.logger.log(`🔍 Indexing repo: ${full_name} (⭐${repo.stargazers_count})`);

    try {
      // Set a timeout for the entire indexing process
      const indexingPromise = this.performIndexing(repo);
      const timeoutPromise = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Indexing timeout')), 200000) // 200 second timeout
      );

      return await Promise.race([indexingPromise, timeoutPromise]);
    } catch (error) {
      if (error.message === 'Indexing timeout') {
        this.logger.error(`⏰ Timeout indexing ${full_name} - skipping large repo`);
      } else {
        this.logger.error(`❌ Failed to index ${full_name}: ${error.message}`);
      }
      return false;
    }
  }

  private async performIndexing(repo: GitHubSearchResult): Promise<boolean> {
    const { full_name, name } = repo;
    const [owner, repoName] = full_name.split('/');

    // Find all SKILL.md files in the repository
    this.logger.log(`🔎 Searching for SKILL.md files in ${full_name}...`);
    const skillMdFiles = await this.findAllSkillMdFiles(owner, repoName);
    this.logger.log(`📋 Found ${skillMdFiles.length} SKILL.md files in ${full_name}`);

    if (skillMdFiles.length === 0) {
      this.logger.warn(`Skipping ${full_name}: no SKILL.md found`);
      return false;
    }

    // Process each SKILL.md file as a separate skill
    let createdCount = 0;
    for (const skillMdFile of skillMdFiles) {
      try {
        const success = await this.createSkillFromSkillMd(repo, skillMdFile);
        if (success) {
          createdCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to create skill from ${skillMdFile.path}: ${error.message}`);
      }
    }

    this.logger.log(`Created ${createdCount} skill(s) from ${skillMdFiles.length} SKILL.md file(s) in ${full_name}`);
    return createdCount > 0;
  }

  private async createSkillFromSkillMd(
    repo: GitHubSearchResult, 
    skillMdFile: { path: string; download_url: string; dirPath: string; fileName: string }
  ): Promise<boolean> {
    const { full_name } = repo;
    const [owner, repoName] = full_name.split('/');

    // Fetch SKILL.md content
    const skillMdContent = await this.fetchRawUrl(skillMdFile.download_url);
    if (!skillMdContent) {
      this.logger.warn(`Failed to fetch SKILL.md content from ${skillMdFile.download_url}`);
      return false;
    }

    // Parse frontmatter
    const { data: frontmatter, content: body } = matter(skillMdContent);
    
    // Use frontmatter name or directory name as skill name
    const skillName = frontmatter.displayName || frontmatter.name || 
                     (skillMdFile.dirPath ? skillMdFile.dirPath.split('/').pop() : repoName);
    
    const description = frontmatter.description || body.slice(0, 2000) || repo.description || '';

    if (!description || description.length < 10) {
      this.logger.warn(`Skipping ${skillMdFile.path}: no meaningful description`);
      return false;
    }

    // Check if skill already exists
    const existingSkill = await this.prisma.skill.findFirst({
      where: {
        sourceRepo: full_name,
        sourcePath: skillMdFile.dirPath,
      },
    });

    if (existingSkill) {
      this.logger.log(`Skill already exists: ${skillName} (${skillMdFile.dirPath})`);
      return false;
    }

    // Determine category
    const category = this.categorizeRepo(repo);

    // Upload original SKILL.md to S3 with actual filename
    const fileName = skillMdFile.fileName;
    const s3Key = `skills/discovery/${owner}-${repoName}/${skillMdFile.dirPath || 'root'}/${fileName}`;
    const fileBuffer = Buffer.from(skillMdContent, 'utf-8');
    await this.s3Service.uploadFile(fileBuffer, s3Key, 'text/markdown', {
      originalName: fileName,
      skillName: skillName,
      sourceRepo: full_name,
      sourcePath: skillMdFile.dirPath,
    });
    const fileSize = fileBuffer.length;

    // Detect platforms
    const platforms = this.platformDetector
      ? this.platformDetector.detect({ name: skillName, description, language: repo.language, topics: JSON.stringify(repo.topics || []) })
      : [];

    // Create skill record with transaction safety
    const skill = await this.prisma.$transaction(async (tx) => {
      const createdSkill = await tx.skill.create({
        data: {
          userId: SYSTEM_USER_ID,
          name: skillName,
          description: description.slice(0, 2000),
          filePath: s3Key,
          fileSize: fileSize,
          category: category,
          sourceRepo: full_name,
          sourcePath: skillMdFile.dirPath || '',
          stars: repo.stargazers_count,
          language: repo.language,
          topics: JSON.stringify(repo.topics || []),
          repoUrl: repo.html_url,
          authorName: repo.owner?.login || owner,
          authorAvatar: repo.owner?.avatar_url || null,
          lastCommitAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
          platforms: JSON.stringify(platforms),
        },
      });

      // Create scan result in the same transaction
      await tx.scanResult.create({
        data: {
          skillId: createdSkill.id,
          status: 'PENDING',
          scanSummary: 'Discovery skill - security scan pending',
        },
      });

      return createdSkill;
    });

    this.logger.log(`Created skill: ${skillName} (${skillMdFile.dirPath}) [${category}]`);

    // Compute quality score
    if (this.qualityAnalyzer) {
      setImmediate(() => this.qualityAnalyzer.analyzeAndSave(skill.id));
    }

    // Trigger security scan
    // Get default branch from repo metadata
    const repoMeta = await this.fetchRepoMetadata(owner, repoName);
    const defaultBranch = repoMeta?.default_branch || 'main';
    const skillMdUrl = `https://raw.githubusercontent.com/${full_name}/${defaultBranch}/${skillMdFile.path}`;
    setImmediate(() => this.scanService.triggerScanByUrl(skill.id, skillMdUrl, 'raw'));

    return true;
  }

  private async updateRepoMetadata(repo: GitHubSearchResult) {
    // Update all skills from the same repository
    const skills = await this.prisma.skill.findMany({
      where: { sourceRepo: repo.full_name },
    });

    if (skills.length === 0) return;

    this.logger.debug(`Updating metadata for ${skills.length} skill(s) from ${repo.full_name}`);
    
    for (const skill of skills) {
      await this.prisma.skill.update({
        where: { id: skill.id },
        data: {
          stars: repo.stargazers_count,
          language: repo.language,
          topics: JSON.stringify(repo.topics || []),
          authorAvatar: repo.owner.avatar_url,
          lastCommitAt: new Date(repo.pushed_at),
        },
      });
    }
  }

  private categorizeRepo(repo: GitHubSearchResult): string {
    const text = [
      repo.full_name,
      repo.description || '',
      ...(repo.topics || []),
    ]
      .join(' ')
      .toLowerCase();

    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        return rule.category;
      }
    }
    return DEFAULT_CATEGORY;
  }

  private async packageRepo(repo: GitHubSearchResult): Promise<string> {
    const storageDir = path.resolve('./storage/discovery', repo.full_name.replace('/', '-'));
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const zipPath = path.join(storageDir, `${repo.name}.zip`);

    // Get default branch from repo metadata
    const [owner, repoName] = repo.full_name.split('/');
    const repoMeta = await this.fetchRepoMetadata(owner, repoName);
    const defaultBranch = repoMeta?.default_branch || 'main';

    // Fetch key files from repo root
    const filesToFetch = ['SKILL.md', 'README.md', 'package.json', 'pyproject.toml', 'setup.py'];
    const files: Array<{ name: string; content: string }> = [];

    for (const fileName of filesToFetch) {
      const content = await this.fetchRawFile(repo.full_name, fileName, defaultBranch);
      if (content) {
        files.push({ name: fileName, content });
      }
    }

    // Also try to fetch src/ or lib/ directory listing for context
    const srcFiles = await this.fetchDirFiles(repo.full_name, 'src', 5);
    files.push(...srcFiles);

    if (files.length === 0) {
      // At minimum create a placeholder
      files.push({
        name: 'README.md',
        content: `# ${repo.name}\n\n${repo.description || 'No description available.'}\n\nSource: ${repo.html_url}`,
      });
    }

    // Create zip
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      for (const file of files) {
        archive.append(file.content, { name: file.name });
      }

      archive.finalize();
    });

    return zipPath;
  }

  private async fetchDirFiles(
    repoFullName: string,
    dirPath: string,
    maxFiles: number,
  ): Promise<Array<{ name: string; content: string }>> {
    const files: Array<{ name: string; content: string }> = [];
    try {
      const url = `https://api.github.com/repos/${repoFullName}/contents/${dirPath}`;
      const data = await this.fetchGitHubApiWithRateLimit(url);
      if (!Array.isArray(data)) return files;

      let count = 0;
      for (const item of data) {
        if (count >= maxFiles) break;
        if (item.type === 'file' && item.download_url) {
          const ext = path.extname(item.name).toLowerCase();
          if (['.ts', '.js', '.py', '.json', '.md', '.yaml', '.yml'].includes(ext)) {
            const content = await this.fetchRawUrl(item.download_url);
            if (content && content.length < 512 * 1024) {
              files.push({ name: `${dirPath}/${item.name}`, content });
              count++;
            }
          }
        }
      }
    } catch {
      // Directory might not exist, that's fine
    }
    return files;
  }

  // ── GitHub API helpers ──

  private async searchGitHub(query: string, page: number, searchType: string = 'repository'): Promise<GitHubSearchResponse | null> {
    const baseFilters = `stars:>=${MIN_STARS}`;
    const searchQuery = searchType === 'repository' && !query.startsWith('topic:') && !query.startsWith('filename:')
      ? `${query} in:name,description,topics ${baseFilters}`
      : query.startsWith('topic:') 
        ? `${query} ${baseFilters}`
        : query;
    
    const q = encodeURIComponent(searchQuery);
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`;

    this.logger.debug(`API call: ${url}`);

    try {
      const data = await this.fetchGitHubApiWithRateLimit(url);
      return data as GitHubSearchResponse;
    } catch (err) {
      if (err.message?.includes('403')) {
        this.logger.warn('GitHub Repository Search API rate limited, waiting...');
        await this.sleep(RATE_LIMIT_PAUSE_MS);
        return this.searchGitHub(query, page, searchType);
      }
      throw err;
    }
  }

  private async fetchGitHubApiWithRateLimit(url: string, retryCount = 0): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_TOKEN; // For automated discovery - separate from user uploads
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    
    // Check rate limit headers
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
    const reset = parseInt(res.headers.get('X-RateLimit-Reset') || '0');
    
    this.logger.debug(`Rate limit: ${remaining} remaining`);
    
    // Enhanced rate limiting with exponential backoff
    if (remaining < RATE_LIMIT_THRESHOLD) {
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

  private async fetchGitHubApi(url: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_TOKEN; // For automated discovery - separate from user uploads
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${url}`);
    }
    return res.json();
  }

  private async fetchRawFile(repoFullName: string, filePath: string, branch: string = 'main'): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${repoFullName}/${branch}/${filePath}`;
    return this.fetchRawUrl(url);
  }

  private async fetchRawUrl(url: string): Promise<string | null> {
    const headers: Record<string, string> = {
      'User-Agent': 'SafuSkill-Bot',
    };
    const token = process.env.GITHUB_TOKEN; // For automated discovery - separate from user uploads
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

  private async fetchRepoMetadata(owner: string, repo: string): Promise<any | null> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SafuSkill-Bot',
      };
      const token = process.env.GITHUB_TOKEN; // For automated discovery - separate from user uploads
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
