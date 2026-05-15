import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { ScanService } from '../scan/scan.service';
import { SEARCH_CONFIGS, SYSTEM_USER_ID, AUTO_DISCOVERY_SOURCE, SearchConfig } from './github-repo.config';

interface GitHubSearchItem {
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  clone_url: string;
  language?: string;
  stargazers_count: number;
  updated_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

@Injectable()
export class AutoDiscoveryService {
  private readonly logger = new Logger(AutoDiscoveryService.name);
  
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private scanService: ScanService,
  ) {}

  async discoverSkills() {
    this.logger.log('🔍 Starting auto-discovery of skills...');
    
    let totalDiscovered = 0;
    let totalProcessed = 0;

    for (const searchConfig of SEARCH_CONFIGS) {
      try {
        this.logger.log(`🔎 Processing search config: ${searchConfig.keywords.join(' + ')}`);
        const discovered = await this.searchAndProcessRepos(searchConfig);
        totalDiscovered += discovered.discovered;
        totalProcessed += discovered.processed;
        
        this.logger.log(`✅ Search config completed. Found: ${discovered.discovered}, Processed: ${discovered.processed}`);
        
        // Rate limiting - wait between different search queries
        await this.delay(2000);
      } catch (error) {
        this.logger.error(`❌ Failed to process search config ${searchConfig.keywords.join('+')}: ${error.message}`);
        this.logger.error(error.stack);
      }
    }

    this.logger.log(`🎯 Auto-discovery completed. Total discovered: ${totalDiscovered}, Total processed: ${totalProcessed}`);
  }

  private async searchAndProcessRepos(config: SearchConfig): Promise<{discovered: number, processed: number}> {
    const query = config.keywords.join(' ');
    this.logger.log(`Searching for repositories with: ${query}`);

    const repos = await this.searchGitHubRepositories(query, config.rateLimit);
    this.logger.log(`Found ${repos.length} repositories for query: ${query}`);

    let processed = 0;
    for (const repo of repos) {
      try {
        const hasSkills = await this.analyzeRepository(repo, config);
        if (hasSkills) {
          processed++;
        }
        
        // Rate limiting between repo analysis
        await this.delay(1000);
      } catch (error) {
        this.logger.warn(`Failed to analyze repo ${repo.full_name}: ${error.message}`);
      }
    }

    return { discovered: repos.length, processed };
  }

  private async searchGitHubRepositories(query: string, limit: number): Promise<GitHubSearchItem[]> {
    this.logger.log(`🌐 GitHub Search API: ${query} (limit: ${limit})`);
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(limit, 100)}`;
    
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-AutoDiscovery',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      this.logger.debug(`✅ GitHub token found, length: ${token.length}`);
    } else {
      this.logger.warn('⚠️ GITHUB_TOKEN not set, search API will be severely rate limited');
    }

    try {
      this.logger.debug(`📡 Sending request to: ${url}`);
      const res = await fetch(url, { headers });
      
      this.logger.debug(`📡 Response status: ${res.status}`);
      this.logger.debug(`📡 Rate limit remaining: ${res.headers.get('X-RateLimit-Remaining')}`);
      this.logger.debug(`📡 Rate limit reset: ${new Date(parseInt(res.headers.get('X-RateLimit-Reset')) * 1000)}`);
      
      if (!res.ok) {
        if (res.status === 403) {
          const resetTime = res.headers.get('X-RateLimit-Reset');
          this.logger.warn(`🚫 GitHub Search API rate limited. Reset at: ${new Date(parseInt(resetTime) * 1000)}`);
          const errorBody = await res.text();
          this.logger.warn(`Error details: ${errorBody}`);
          return [];
        }
        const errorBody = await res.text();
        this.logger.error(`❌ GitHub Search API error ${res.status}: ${errorBody}`);
        throw new Error(`GitHub Search API error ${res.status}`);
      }

      const data: GitHubSearchResponse = await res.json();
      this.logger.log(`📊 Search results: ${data.items?.length || 0} repositories found (total: ${data.total_count})`);
      
      if (data.items && data.items.length > 0) {
        this.logger.debug(`🔍 Sample results: ${data.items.slice(0, 3).map(r => r.full_name).join(', ')}`);
      }
      
      return data.items || [];
    } catch (error) {
      this.logger.error(`💥 Failed to search GitHub repositories: ${error.message}`);
      this.logger.error(error.stack);
      return [];
    }
  }

  private async analyzeRepository(repo: GitHubSearchItem, config: SearchConfig): Promise<boolean> {
    this.logger.debug(`🔍 Analyzing repository: ${repo.full_name}`);
    
    // Skip if we already have this repo in auto-discovery
    const existing = await this.prisma.skill.findFirst({
      where: {
        sourceRepo: AUTO_DISCOVERY_SOURCE,
        sourcePath: repo.full_name,
      },
    });

    if (existing) {
      this.logger.debug(`⏭️ Repository ${repo.full_name} already exists in auto-discovery, skipping`);
      return false;
    }

    // Try to detect skill-like structure
    this.logger.debug(`🔎 Detecting skill types for ${repo.full_name}...`);
    const skillTypes = await this.detectSkillTypes(repo);
    if (skillTypes.length === 0) {
      this.logger.debug(`❌ No recognizable skill patterns found in ${repo.full_name}`);
      return false;
    }

    this.logger.log(`✅ Found skill types in ${repo.full_name}: ${skillTypes.join(', ')}`);

    // Create skill entry for discovered repository
    await this.createSkillFromRepo(repo, config, skillTypes);
    return true;
  }

  private async detectSkillTypes(repo: GitHubSearchItem): Promise<string[]> {
    const [owner, repoName] = repo.full_name.split('/');
    const skillTypes: string[] = [];

    // Check for common skill indicators
    const indicators = [
      { pattern: /mcp[-_]?server/i, type: 'MCP Server' },
      { pattern: /claude[-_]?skill/i, type: 'Claude Skill' },
      { pattern: /agent[-_]?tool/i, type: 'Agent Tool' },
      { pattern: /ai[-_]?skill/i, type: 'AI Skill' },
      { pattern: /llm[-_]?plugin/i, type: 'LLM Plugin' },
    ];

    // Check repo name and description
    for (const indicator of indicators) {
      if (indicator.pattern.test(repo.name) || 
          (repo.description && indicator.pattern.test(repo.description))) {
        skillTypes.push(indicator.type);
      }
    }

    // Additional checks for file presence (basic structure detection)
    try {
      const hasReadme = await this.checkFileExists(owner, repoName, 'README.md');
      const hasPackageJson = await this.checkFileExists(owner, repoName, 'package.json');
      const hasRequirements = await this.checkFileExists(owner, repoName, 'requirements.txt');
      const hasSetupPy = await this.checkFileExists(owner, repoName, 'setup.py');

      // Must have some basic project structure
      if (!hasReadme && !hasPackageJson && !hasRequirements && !hasSetupPy) {
        return [];
      }

      // If we found patterns but no specific type, classify by language
      if (skillTypes.length === 0) {
        if (hasPackageJson) {
          skillTypes.push('JavaScript Tool');
        } else if (hasRequirements || hasSetupPy) {
          skillTypes.push('Python Tool');
        }
      }
    } catch (error) {
      this.logger.debug(`Could not check file structure for ${repo.full_name}: ${error.message}`);
    }

    return skillTypes;
  }

  private async checkFileExists(owner: string, repo: string, fileName: string): Promise<boolean> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SafuSkill-AutoDiscovery',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { headers });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async createSkillFromRepo(repo: GitHubSearchItem, config: SearchConfig, skillTypes: string[]): Promise<void> {
    const skillName = repo.name;
    const description = repo.description || `Auto-discovered ${skillTypes[0]} from ${repo.full_name}`;
    
    this.logger.log(`📦 Creating skill from repository: ${repo.full_name}`);

    try {
      // Download repository as zip file
      const zipBuffer = await this.downloadRepositoryAsZip(repo);
      if (!zipBuffer) {
        this.logger.error(`❌ Failed to download repository ${repo.full_name}`);
        return;
      }

      // Generate S3 key using the same pattern as user uploads
      const s3Key = this.s3Service.generateKey(SYSTEM_USER_ID, `${repo.full_name.replace('/', '_')}.zip`);
      
      // Upload to S3
      const fileUrl = await this.s3Service.uploadFile(
        zipBuffer,
        s3Key,
        'application/zip',
        {
          originalName: `${repo.full_name.replace('/', '_')}.zip`,
          skillName: skillName,
          uploadedBy: SYSTEM_USER_ID,
          source: 'auto-discovery',
          repo: repo.full_name,
          skill_types: skillTypes.join(','),
        }
      );

      this.logger.log(`📤 Uploaded ${repo.full_name} to S3: ${s3Key}`);

      // Create skill entry in database
      const skill = await this.prisma.skill.create({
        data: {
          userId: SYSTEM_USER_ID,
          name: skillName,
          description: description.slice(0, 2000),
          filePath: s3Key, // Store S3 key, same as user uploads
          fileSize: zipBuffer.length,
          category: config.category,
          sourceRepo: AUTO_DISCOVERY_SOURCE, // Special marker for auto-discovered skills
          sourcePath: repo.full_name, // Store the actual repo path here
        },
      });

      this.logger.log(`💾 Created skill in database: ${skillName} (ID: ${skill.id})`);

      // Create initial scan result with PENDING status (same as user uploads)
      await this.prisma.scanResult.create({
        data: {
          skillId: skill.id,
          status: 'PENDING',
          scanSummary: 'Auto-discovered skill - security scan pending',
        },
      });

      // Trigger security scan using the same method as user uploads
      const signedUrl = await this.s3Service.getSignedDownloadUrl(s3Key);
      setImmediate(() => this.scanService.triggerScan(skill.id, signedUrl));
      
      this.logger.log(`🔒 Security scan triggered for ${skillName}`);

    } catch (error) {
      this.logger.error(`💥 Failed to create skill from ${repo.full_name}: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  private async downloadRepositoryAsZip(repo: GitHubSearchItem): Promise<Buffer | null> {
    const zipUrl = `${repo.clone_url.replace('.git', '')}/archive/refs/heads/main.zip`;
    
    this.logger.debug(`📥 Downloading repository zip: ${zipUrl}`);

    const headers: Record<string, string> = {
      'User-Agent': 'SafuSkill-AutoDiscovery',
    };

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(zipUrl, { headers });
      
      if (!response.ok) {
        // Try with 'master' branch if 'main' fails
        if (response.status === 404) {
          const masterUrl = `${repo.clone_url.replace('.git', '')}/archive/refs/heads/master.zip`;
          this.logger.debug(`📥 Retrying with master branch: ${masterUrl}`);
          
          const masterResponse = await fetch(masterUrl, { headers });
          if (!masterResponse.ok) {
            this.logger.warn(`❌ Failed to download ${repo.full_name}: ${masterResponse.status}`);
            return null;
          }
          return Buffer.from(await masterResponse.arrayBuffer());
        }
        
        this.logger.warn(`❌ Failed to download ${repo.full_name}: ${response.status}`);
        return null;
      }

      const zipBuffer = Buffer.from(await response.arrayBuffer());
      this.logger.debug(`✅ Downloaded ${repo.full_name}: ${zipBuffer.length} bytes`);
      return zipBuffer;

    } catch (error) {
      this.logger.error(`💥 Error downloading ${repo.full_name}: ${error.message}`);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}