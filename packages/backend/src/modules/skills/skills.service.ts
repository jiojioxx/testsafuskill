import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { CreateSkillDto, CreateSkillFromGithubDto } from './dto/create-skill.dto';
import { ScanService } from '../scan/scan.service';
import * as path from 'path';
import * as fs from 'fs';
import * as archiver from 'archiver';
import * as matter from 'gray-matter';
import * as unzipper from 'unzipper';

interface CacheEntry {
  data: any;
  timestamp: number;
  key: string;
}

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private scanService: ScanService,
  ) {}

  private getCacheKey(page: number, limit: number, category?: string, sortBy?: string, search?: string): string {
    const categoryKey = category === 'All Skills' ? 'all' : (category || 'no-category');
    const searchKey = search || 'no-search';
    return `skills:${page}:${limit}:${categoryKey}:${sortBy || 'downloads'}:${searchKey}`;
  }

  private isValidCacheEntry(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  private setCacheEntry(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key
    });
    
    // Cleanup old entries (simple strategy: remove entries older than TTL)
    for (const [k, entry] of this.cache.entries()) {
      if (!this.isValidCacheEntry(entry)) {
        this.cache.delete(k);
      }
    }
  }

  private getCacheEntry(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && this.isValidCacheEntry(entry)) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key); // Remove expired entry
    }
    return null;
  }

  private clearRelatedCache(): void {
    // Clear all skills-related cache entries when data changes
    for (const key of this.cache.keys()) {
      if (key.startsWith('skills:')) {
        this.cache.delete(key);
      }
    }
  }

  // Public method for other services to clear cache
  public clearSkillsCache(): void {
    this.clearRelatedCache();
  }

  async create(userId: string, dto: CreateSkillDto, file: Express.Multer.File) {
    // Unzip in memory and find SKILL.md — reject early if not found
    const skillMdContent = await this.findSkillMdInZip(file.buffer);
    if (!skillMdContent) {
      throw new BadRequestException(
        'No SKILL.md file found in the uploaded zip. Please ensure your skill package contains a SKILL.md file.',
      );
    }

    // Upload the full zip to S3
    const s3Key = this.s3Service.generateKey(userId, file.originalname);
    await this.s3Service.uploadFile(file.buffer, s3Key, file.mimetype, {
      originalName: file.originalname,
      skillName: dto.name,
      uploadedBy: userId,
    });

    const skill = await this.prisma.skill.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        filePath: s3Key,
        fileSize: file.size,
        category: dto.category || 'Upload',
      },
    });

    const scanResult = await this.prisma.scanResult.create({
      data: { skillId: skill.id, status: 'PENDING' },
    });

    // Scan using SKILL.md content directly — no need to re-download from S3
    setImmediate(() => this.scanService.triggerScanByContent(skill.id, skillMdContent));

    // Clear cache since new skill was added
    this.clearRelatedCache();

    return {
      ...skill,
      scanResult,
      user: await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, avatarUrl: true },
      }),
    };
  }

  private async findSkillMdInZip(buffer: Buffer): Promise<string | null> {
    try {
      const directory = await unzipper.Open.buffer(buffer);
      const skillMdFiles = directory.files.filter(
        (f) => path.basename(f.path).toLowerCase() === 'skill.md' && f.type === 'File',
      );
      
      if (skillMdFiles.length === 0) return null;
      
      const rootLevel = skillMdFiles.find((f) => !f.path.includes('/') || f.path.split('/').length === 2);
      const entry = rootLevel || skillMdFiles[0];
      
      const content = await entry.buffer();
      return content.toString('utf-8');
    } catch {
      return null;
    }
  }

  async createFromGithub(userId: string, dto: CreateSkillFromGithubDto) {
    // Parse GitHub URL to extract owner, repo, and path
    const { owner, repo, startPath } = this.parseGithubUrl(dto.githubUrl);
    
    try {
      // Non-recursive: only check for SKILL.md in the specified directory
      const skillMdInfo = await this.findSkillMdInDirectory(owner, repo, startPath);
      
      if (!skillMdInfo) {
        const pathInfo = startPath ? ` in the specified path "${startPath}"` : ' in the repository root';
        throw new BadRequestException(`No SKILL.md file found${pathInfo}. Please provide a direct link to a directory containing SKILL.md or ensure the repository root has a SKILL.md file.`);
      }

      // Download the SKILL.md content (with retry + API fallback)
      let skillMdContent = await this.fetchRawUrl(skillMdInfo.download_url);
      if (!skillMdContent) {
        console.log(`[GitHub URL Upload] Raw fetch failed, trying GitHub API fallback for: ${skillMdInfo.path}`);
        skillMdContent = await this.fetchRawUrlViaApi(owner, repo, skillMdInfo.path);
      }
      if (!skillMdContent) {
        throw new BadRequestException('Unable to download SKILL.md file from the repository. The file may be temporarily unavailable, please try again later.');
      }

      // Parse skill metadata from SKILL.md frontmatter
      const { name, description } = this.parseSkillMetadataFromContent(skillMdContent, dto, repo);

      // Use the actual filename from GitHub
      const fileName = skillMdInfo.name;
      const s3Key = this.s3Service.generateKey(userId, fileName);
      
      // Upload SKILL.md content to S3
      const fileBuffer = Buffer.from(skillMdContent, 'utf-8');
      const fileUrl = await this.s3Service.uploadFile(
        fileBuffer,
        s3Key,
        'text/markdown',
        {
          originalName: fileName,
          skillName: name || repo,
          uploadedBy: userId,
          sourceUrl: dto.githubUrl,
          skillMdPath: skillMdInfo.path,
        }
      );

      // Fetch GitHub repo metadata
      const repoMeta = await this.fetchRepoMetadata(owner, repo);

      // Create skill record
      const skill = await this.prisma.skill.create({
        data: {
          userId,
          name: name || repo,
          description: description || `Skill imported from ${dto.githubUrl}`,
          filePath: s3Key,
          fileSize: BigInt(fileBuffer.length),
          category: dto.category || 'Upload',
          sourceRepo: `${owner}/${repo}`,
          sourcePath: skillMdInfo.path,
          repoUrl: repoMeta.html_url || `https://github.com/${owner}/${repo}`,
          stars: repoMeta.stargazers_count || 0,
          language: repoMeta.language || null,
          topics: repoMeta.topics?.length ? JSON.stringify(repoMeta.topics) : null,
          authorName: repoMeta.owner?.login || owner,
          authorAvatar: repoMeta.owner?.avatar_url || null,
          lastCommitAt: repoMeta.pushed_at ? new Date(repoMeta.pushed_at) : null,
        },
      });

      // Create initial scan result
      const scanResult = await this.prisma.scanResult.create({
        data: {
          skillId: skill.id,
          status: 'PENDING',
        },
      });

      // Trigger security scan using the raw SKILL.md URL with type="raw"
      const defaultBranch = repoMeta.default_branch || 'main';
      const rawSkillMdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${skillMdInfo.path}`;
      setImmediate(() => this.scanService.triggerScanByUrl(skill.id, rawSkillMdUrl, 'raw'));

      // Clear cache since new skill was added
      this.clearRelatedCache();

      // Return skill with scan result and user info
      return {
        ...skill,
        scanResult,
        user: await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, avatarUrl: true },
        }),
      };
    } catch (error) {
      console.error('Error creating skill from GitHub URL:', error);
      
      if (error instanceof BadRequestException) {
        throw error; // Re-throw user-friendly errors
      }
      if (error instanceof ForbiddenException || error instanceof ConflictException) {
        throw error;
      }
      if (error?.code === 'P2002') {
        throw new ConflictException('This skill has already been imported. The same SKILL.md from this repository already exists.');
      }
      
      // Convert any other system errors to user-friendly messages
      const errorMessage = error?.message || 'Unknown error occurred';
      if (errorMessage.includes('rate limit')) {
        throw new BadRequestException('GitHub API rate limit exceeded. Please try again later.');
      }
      if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET') || errorMessage.includes('ETIMEDOUT')) {
        throw new BadRequestException('Connection timeout. Please check your internet connection and try again.');
      }
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        throw new BadRequestException('Repository not found. Please check the GitHub URL and ensure the repository exists.');
      }
      if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        throw new BadRequestException('Access denied. Please ensure the repository is public.');
      }
      
      throw new BadRequestException('Failed to import skill from GitHub. Please check the URL and try again.');
    }
  }

  /**
   * Parse GitHub URL to extract owner, repo, and optional directory path
   */
  private parseGithubUrl(url: string): { owner: string; repo: string; startPath: string } {
    // Support various GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo/tree/main/path/to/dir
    // https://github.com/owner/repo/blob/main/path/to/file
    
    const patterns = [
      // Tree/blob URL with path: https://github.com/owner/repo/tree/main/path/to/dir
      /github\.com\/([^\/]+)\/([^\/]+)\/(?:tree|blob)\/[^\/]+\/(.+)/,
      // Basic repo URL: https://github.com/owner/repo
      /github\.com\/([^\/]+)\/([^\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const [, owner, repoName, path = ''] = match;
        const repo = repoName.replace(/\.git$/, ''); // Remove .git suffix if present
        return { owner, repo, startPath: path };
      }
    }

    throw new BadRequestException('Invalid GitHub URL format. Please provide a valid GitHub repository or directory URL (e.g., https://github.com/owner/repo or https://github.com/owner/repo/tree/main/path).');
  }

  /**
   * Non-recursive: Find SKILL.md file only in the specified directory
   */
  private async findSkillMdInDirectory(
    owner: string,
    repo: string,
    dirPath: string
  ): Promise<{ path: string; download_url: string; name: string } | null> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SafuSkill-Bot',
      };

      const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log(`[GitHub URL Upload] Checking directory: ${url}`);
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        if (res.status === 403) {
          throw new BadRequestException('GitHub API access denied. This could be because the repository is private, API rate limit exceeded, or invalid GitHub token. Please ensure the repository is public.');
        } else if (res.status === 404) {
          throw new BadRequestException('Repository or path not found. Please check the GitHub URL and ensure the repository/directory exists.');
        } else {
          throw new BadRequestException(`Failed to access GitHub repository (${res.status}). Please check the URL and try again.`);
        }
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : [];

      // Look for SKILL.md in current directory only
      const skillMdFile = items.find((item: any) => 
        item.type === 'file' && 
        item.name.toLowerCase() === 'skill.md'
      );

      if (skillMdFile && skillMdFile.download_url) {
        return {
          path: skillMdFile.path,
          download_url: skillMdFile.download_url,
          name: skillMdFile.name
        };
      }

      return null;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error; // Re-throw user-friendly errors
      }
      console.error(`Error checking directory ${owner}/${repo}:${dirPath}:`, error);
      throw new BadRequestException('Failed to access GitHub repository. Please check the URL and ensure the repository is accessible.');
    }
  }

  /**
   * Parse skill metadata from SKILL.md content
   */
  private parseSkillMetadataFromContent(
    skillMdContent: string,
    dto: CreateSkillFromGithubDto,
    defaultName: string,
  ): { name: string; description: string } {
    let name = dto.name || defaultName;
    let description = dto.description || '';

    try {
      const { data: frontmatter, content: markdownBody } = matter(skillMdContent);
      name = dto.name || frontmatter.displayName || frontmatter.name || name;
      description = dto.description || frontmatter.description || markdownBody.slice(0, 500) || description;
    } catch (error) {
      console.warn('Error parsing SKILL.md frontmatter:', error);
      // If frontmatter parsing fails, extract from content
      if (!dto.description) {
        // Try to extract description from markdown content
        const lines = skillMdContent.split('\n').filter(line => line.trim());
        const descLines = lines.slice(0, 3).filter(line => 
          !line.startsWith('#') && 
          !line.startsWith('---') && 
          line.trim().length > 0
        );
        description = descLines.join(' ').slice(0, 500) || description;
      }
    }

    return { name, description };
  }

  private async downloadRepository(owner: string, repo: string, tempDir: string): Promise<any> {
    // Fetch repository contents from GitHub API
    const url = `https://api.github.com/repos/${owner}/${repo}/contents`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const files = await this.collectRepositoryFiles(owner, repo, '', tempDir);
    return { owner, repo, files };
  }

  private async collectRepositoryFiles(
    owner: string,
    repo: string,
    dirPath: string,
    baseDir: string,
  ): Promise<Array<{ path: string; content: string }>> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`GitHub API error ${res.status}: ${url}`);
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : [];
      const files: Array<{ path: string; content: string }> = [];

      for (const item of items) {
        if (item.type === 'file' && item.download_url) {
          const content = await this.fetchRawUrl(item.download_url);
          if (content) {
            // Write file to temporary directory
            const filePath = path.join(baseDir, item.path);
            const fileDir = path.dirname(filePath);
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            fs.writeFileSync(filePath, content);
            files.push({ path: item.path, content });
          }
        } else if (item.type === 'dir') {
          const subFiles = await this.collectRepositoryFiles(owner, repo, item.path, baseDir);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      console.error(`Error fetching repository contents: ${error.message}`);
      return [];
    }
  }

  private async fetchRawUrl(url: string): Promise<string | null> {
    const headers: Record<string, string> = {
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[GitHub URL Upload] Fetching raw content (attempt ${attempt}/${MAX_RETRIES}): ${url}`);
        const res = await fetch(url, { headers });

        if (res.ok) {
          const content = await res.text();
          console.log(`[GitHub URL Upload] Successfully fetched content (${content.length} chars)`);
          return content;
        }

        console.error(`[GitHub URL Upload] Failed to fetch raw content: ${res.status} ${res.statusText}`);

        if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`[GitHub URL Upload] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return null;
      } catch (error) {
        console.error(`[GitHub URL Upload] Error fetching raw content (attempt ${attempt}):`, error);
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return null;
      }
    }

    return null;
  }

  private async fetchRawUrlViaApi(owner: string, repo: string, filePath: string): Promise<string | null> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };

    const token = process.env.GITHUB_USER_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    try {
      console.log(`[GitHub URL Upload] Fallback: fetching via GitHub API: ${url}`);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.error(`[GitHub URL Upload] Fallback API fetch failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = await res.json();
      if (data.encoding === 'base64' && data.content) {
        const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
        console.log(`[GitHub URL Upload] Fallback API fetch succeeded (${content.length} chars)`);
        return content;
      }
      return null;
    } catch (error) {
      console.error(`[GitHub URL Upload] Fallback API fetch error:`, error);
      return null;
    }
  }

  private parseSkillMetadata(
    repoData: any,
    dto: CreateSkillFromGithubDto,
  ): { name: string; description: string } {
    // Try to find SKILL.md in the downloaded files (strict filename match)
    const skillMdFile = repoData.files?.find(
      (f: any) => path.basename(f.path).toLowerCase() === 'skill.md',
    );

    let name = dto.name || repoData.repo;
    let description = dto.description || '';

    if (skillMdFile) {
      try {
        const { data: frontmatter, content: markdownBody } = matter(skillMdFile.content);
        name = dto.name || frontmatter.displayName || frontmatter.name || name;
        description = dto.description || frontmatter.description || markdownBody.slice(0, 500) || description;
      } catch (error) {
        console.warn('Error parsing SKILL.md frontmatter:', error);
      }
    }

    return { name, description };
  }

  private async createZipFromDirectory(dirPath: string): Promise<string> {
    const zipPath = `${dirPath}.zip`;

    return new Promise<string>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);
      archive.pipe(output);

      archive.directory(dirPath, false);
      archive.finalize();
    });
  }

  private cleanupTempFiles(tempDir: string, zipPath: string) {
    try {
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      // Clean up temporary zip file
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    } catch (error) {
      console.warn('Error cleaning up temporary files:', error);
    }
  }

  async search(query: string, page = 1, limit = 10) {
    const q = query.trim();
    const where = q ? {
      OR: [
        { name: { contains: q } },
        { sourceRepo: { contains: q } },
      ],
    } : {};
    const skip = (page - 1) * limit;
    const [skills, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { downloadCount: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          sourceRepo: true,
          language: true,
          stars: true,
          authorName: true,
          authorAvatar: true,
          category: true,
          downloadCount: true,
          // 前端 CreateTokenPage 需要判断该 skill 是否已有活跃代币
          tokenLaunches: {
            where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.skill.count({ where }),
    ]);
    return { skills, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findAll(page = 1, limit = 20, category?: string, sortBy?: 'stars' | 'score' | 'recent' | 'downloads', search?: string) {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(page, limit, category, sortBy, search);
      const cachedResult = this.getCacheEntry(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      const skip = (page - 1) * limit;
      const where: any = {};
      
      // Category filter
      if (category) {
        where.category = category;
      }
      
      // Search filter - fuzzy search on name field (case insensitive handled in app layer)
      if (search && search.trim()) {
        where.name = {
          contains: search.trim()
        };
      }
      
      // Determine sort order based on sortBy parameter
      let orderBy: any = { downloadCount: 'desc' }; // default
      
      switch (sortBy) {
        case 'stars':
          orderBy = { stars: 'desc' };
          break;
        case 'score':
          orderBy = { score: 'desc' };
          break;
        case 'recent':
          orderBy = { createdAt: 'desc' };
          break;
        case 'downloads':
          orderBy = { downloadCount: 'desc' };
          break;
      }

      const shouldPin = page === 1 && !search;
      let skills: any[] = [];
      let total = 0;

      if (shouldPin) {
        // Step 1: Fetch featured skill configurations from database
        const featuredConfigs = await this.prisma.featuredSkill.findMany({
          orderBy: { sortOrder: 'asc' },
        });

        if (featuredConfigs.length > 0) {
          // Step 2: Fetch featured skills by sourceRepo + sourcePath
          const featuredSkills = await this.prisma.skill.findMany({
            where: {
              ...where,
              OR: featuredConfigs.map(config => ({
                sourceRepo: config.sourceRepo,
                sourcePath: config.sourcePath,
              })),
            },
            include: {
              user: { select: { id: true, username: true, avatarUrl: true } },
              scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
              tokenLaunches: {
                where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
                select: { id: true, symbol: true, tokenAddress: true, chainId: true },
                take: 1,
              },
            },
          });

          // Sort featured skills by their order in featuredConfigs
          const sortedFeatured = featuredSkills.sort((a, b) => {
            const aIdx = featuredConfigs.findIndex(
              config => a.sourceRepo === config.sourceRepo && a.sourcePath === config.sourcePath
            );
            const bIdx = featuredConfigs.findIndex(
              config => b.sourceRepo === config.sourceRepo && b.sourcePath === config.sourcePath
            );
            return aIdx - bIdx;
          });

          const featuredIds = sortedFeatured.map(s => s.id);

          // Step 3: Fetch remaining skills (exclude featured ones)
          const remainingLimit = Math.max(0, limit - sortedFeatured.length);
          const [remainingSkills, totalCount] = await Promise.all([
            this.prisma.skill.findMany({
              where: {
                ...where,
                id: { notIn: featuredIds },
              },
              skip,
              take: remainingLimit,
              orderBy,
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
                scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
                tokenLaunches: {
                  where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
                  select: { id: true, symbol: true, tokenAddress: true, chainId: true },
                  take: 1,
                },
              },
            }),
            this.prisma.skill.count({ where })
          ]);

          // Step 4: Combine featured + remaining
          skills = [...sortedFeatured, ...remainingSkills];
          total = totalCount;
        } else {
          // No featured skills configured, use normal query
          const [fetchedSkills, totalCount] = await Promise.all([
            this.prisma.skill.findMany({
              where,
              skip,
              take: limit,
              orderBy,
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
                scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
                tokenLaunches: {
                  where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
                  select: { id: true, symbol: true, tokenAddress: true, chainId: true },
                  take: 1,
                },
              },
            }),
            this.prisma.skill.count({ where })
          ]);
          
          skills = fetchedSkills;
          total = totalCount;
        }
      } else {
        // Normal query without pinning
        const [fetchedSkills, totalCount] = await Promise.all([
          this.prisma.skill.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
              user: { select: { id: true, username: true, avatarUrl: true } },
              scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
              tokenLaunches: {
                where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
                select: { id: true, symbol: true, tokenAddress: true, chainId: true },
                take: 1,
              },
            },
          }),
          this.prisma.skill.count({ where })
        ]);
        
        skills = fetchedSkills;
        total = totalCount;
      }

      const result = {
        skills,
        total,
        page,
        limit,
        hasMore: skip + skills.length < total,
      };

      // Cache the result
      this.setCacheEntry(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching skills:', error);

      return {
        skills: [],
        message: 'Database connection issue - please check backend logs',
        total: 0,
        page,
        limit,
        error: true,
      };
    }
  }

  async findByUser(userId: string) {
    return this.prisma.skill.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });
  }

  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: true,
        tokenLaunches: {
          where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
          select: { id: true, name: true, symbol: true, status: true, tokenAddress: true, chainId: true },
          take: 1,
        },
      },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async download(id: string, userId?: string, walletAddress?: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');

    console.log('[download] skillId =', id, 'userId =', userId, 'walletAddress =', walletAddress);

    await this.prisma.$transaction([
      this.prisma.skill.update({
        where: { id },
        data: { downloadCount: { increment: 1 } },
      }),
      this.prisma.skillDownloadRecord.create({
        data: {
          skillId: id,
          userId: userId || null,
          walletAddress: walletAddress || null,
        },
      }),
    ]);

    // Clear cache since download count changed
    this.clearRelatedCache();

    return skill;
  }

  async remove(id: string, userId: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    if (skill.userId !== userId) throw new ForbiddenException('Not your skill');
    const activeToken = await this.prisma.tokenLaunch.findFirst({
      where: { skillId: id, status: { in: ['ACTIVE', 'DEPLOYING'] } },
    });
    if (activeToken) throw new BadRequestException('This skill has an active token and cannot be deleted');

    // Delete file from S3
    try {
      await this.s3Service.deleteFile(skill.filePath);
    } catch (error) {
      console.warn('Failed to delete file from S3:', error);
    }

    await this.prisma.skill.delete({ where: { id } });
    
    // Clear cache since skill was deleted
    this.clearRelatedCache();
    
    return { success: true };
  }

  async count() {
    return this.prisma.skill.count();
  }

  private async fetchRepoMetadata(owner: string, repo: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-Bot',
    };
    const token = process.env.GITHUB_USER_TOKEN; // Dedicated token for user uploads
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      console.log(`[GitHub URL Upload] Fetching repo metadata: ${owner}/${repo}`);
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  }

  /**
   * 单条 rescan：支持 GitHub 和 ZIP 两种来源。
   * GitHub：拼 blob URL → agentguard scan-url
   * ZIP：从 S3 下载 → 解压取 SKILL.md → agentguard scan content
   * 保守策略：任何异常只 log 不更新，宁可不更新也不写脏数据。
   */
  async rescan(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');

    this.logger.log(`[Rescan] skill=${id} name="${skill.name}" sourceRepo=${skill.sourceRepo || 'null'} sourcePath=${skill.sourcePath || 'null'} filePath=${skill.filePath || 'null'}`);

    if (skill.sourceRepo && skill.sourcePath) {
      return this.rescanGithubSkill(skill);
    }

    if (skill.filePath) {
      return this.rescanZipSkill(skill);
    }

    throw new BadRequestException('Skill has no source to rescan (no sourceRepo and no filePath)');
  }

  private async rescanGithubSkill(skill: { id: string; name: string; sourceRepo: string | null; sourcePath: string | null }) {
    const { owner, repo } = this.parseGithubUrl(`https://github.com/${skill.sourceRepo}`);
    let defaultBranch = 'main';
    try {
      const repoMeta = await this.fetchRepoMetadata(owner, repo);
      defaultBranch = repoMeta.default_branch || 'main';
      this.logger.log(`[Rescan] GitHub metadata OK: owner=${owner} repo=${repo} branch=${defaultBranch}`);
    } catch (err) {
      this.logger.warn(`[Rescan] Failed to fetch repo metadata for ${skill.sourceRepo}, using 'main': ${err.message}`);
    }
    const sp = skill.sourcePath!.toLowerCase().endsWith('skill.md')
      ? skill.sourcePath
      : `${skill.sourcePath}/SKILL.md`;
    const githubBlobUrl = `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${sp}`;
    this.logger.log(`[Rescan] GitHub scan: skill=${skill.id} url=${githubBlobUrl}`);

    setImmediate(() => this.scanService.triggerScanByUrl(skill.id, githubBlobUrl, 'github'));

    return {
      success: true,
      message: 'Re-scan initiated (GitHub)',
      skill: { id: skill.id, name: skill.name, scanStatus: 'SCANNING' },
    };
  }

  private async rescanZipSkill(skill: { id: string; name: string; filePath: string }) {
    this.logger.log(`[Rescan] ZIP scan: skill=${skill.id} filePath=${skill.filePath}`);

    setImmediate(async () => {
      try {
        this.logger.log(`[Rescan] Downloading from S3: skill=${skill.id} filePath=${skill.filePath}`);
        const content = await this.downloadSkillMdFromS3(skill.filePath);
        if (!content || content.trim().length === 0) {
          this.logger.error(`[Rescan] Empty content from S3 for skill ${skill.id}, skipping update`);
          return;
        }
        this.logger.log(`[Rescan] S3 download OK: skill=${skill.id} contentLength=${content.length}`);
        await this.scanService.triggerScanByContent(skill.id, content);
        this.logger.log(`[Rescan] ZIP scan completed: skill=${skill.id}`);
      } catch (err) {
        this.logger.error(`[Rescan] ZIP scan failed for skill ${skill.id}: ${err.message}`);
      }
    });

    return {
      success: true,
      message: 'Re-scan initiated (ZIP)',
      skill: { id: skill.id, name: skill.name, scanStatus: 'SCANNING' },
    };
  }

  /**
   * 从 S3 下载文件，如果是 .zip 则解压取 SKILL.md 内容，
   * 如果是 .md 则直接返回内容。
   */
  private async downloadSkillMdFromS3(filePath: string): Promise<string> {
    const s3Obj = await this.s3Service.getFile(filePath);
    const bodyStream = s3Obj.Body;
    if (!bodyStream) throw new Error('S3 returned empty body');

    const chunks: Buffer[] = [];
    for await (const chunk of bodyStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const ext = filePath.toLowerCase().split('.').pop();
    if (ext === 'zip') {
      const unzipper = await import('unzipper');
      const directory = await unzipper.Open.buffer(buffer);
      const skillMdEntry = directory.files.find(
        (f) => f.type === 'File' && f.path.toLowerCase().endsWith('skill.md'),
      );
      if (!skillMdEntry) throw new Error('No SKILL.md found in ZIP');
      const content = await skillMdEntry.buffer();
      return content.toString('utf-8');
    }

    return buffer.toString('utf-8');
  }

  async findAllWithMetadata(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [skills, total] = await Promise.all([
      this.prisma.skill.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true, avatarUrl: true } },
          scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
          tokenLaunches: { select: { id: true, tokenAddress: true } },
        },
      }),
      this.prisma.skill.count(),
    ]);

    return {
      skills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private buildSkillSlug(skill: { authorName: string | null; name: string; userId: string }): string {
    const author = skill.authorName?.trim() || skill.userId.slice(0, 8);
    return `${author}/${skill.name}`;
  }

  private buildSkillResult(skill: { id: string; authorName: string | null; name: string; userId: string; sourceRepo: string | null; sourcePath: string | null }) {
    const slug = this.buildSkillSlug(skill);
    const hasGit = !!skill.sourceRepo;

    if (!hasGit) {
      return { slug, type: 'zip' as const, url: `https://safuskill.ai/api/skills/${skill.id}/download`, branch: 'main' };
    }

    const path = skill.sourcePath!;
    if (!path) {
      return { slug, type: 'repository' as const, url: `https://github.com/${skill.sourceRepo}`, branch: 'main' };
    }
    return { slug, type: 'subpath' as const, url: `https://github.com/${skill.sourceRepo}/tree/main/${path}`, branch: 'main' };
  }

  async lookup(name: string) {
    const skills = await this.prisma.skill.findMany({
      where: { name: { contains: name } },
      orderBy: [{ downloadCount: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: { id: true, authorName: true, name: true, userId: true, sourceRepo: true, sourcePath: true },
    });
    return skills.map((s) => this.buildSkillResult(s));
  }

  async resolve(slug: string) {
    const slashIdx = slug.indexOf('/');
    if (slashIdx === -1) throw new NotFoundException('Invalid slug format, expected authorName/skillName');
    const authorName = slug.slice(0, slashIdx);
    const skillName = slug.slice(slashIdx + 1);

    const skills = await this.prisma.$queryRaw<Array<{ id: string; author_name: string | null; name: string; user_id: string; source_repo: string | null; source_path: string | null }>>`
      SELECT id, author_name, name, user_id, source_repo, source_path
      FROM gh_skills
      WHERE LOWER(author_name) = LOWER(${authorName}) AND LOWER(name) = LOWER(${skillName})
      ORDER BY download_count DESC
      LIMIT 1
    `;

    if (!skills.length) throw new NotFoundException('Skill not found');
    const s = skills[0];
    return this.buildSkillResult({ id: s.id, authorName: s.author_name, name: s.name, userId: s.user_id, sourceRepo: s.source_repo, sourcePath: s.source_path });
  }
}
