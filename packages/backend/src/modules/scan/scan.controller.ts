import { Controller, Get, Post, Param, Query, UseGuards, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ScanService } from './scan.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import * as unzipper from 'unzipper';

const INTERNAL_API_KEY = 'fced51f1d3a043f19910cddd2ccadf98';

@Controller('scan')
export class ScanController {
  private readonly logger = new Logger(ScanController.name);

  constructor(
    private scanService: ScanService,
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  @Get(':skillId')
  getScanResult(@Param('skillId') skillId: string) {
    return this.scanService.getScanResult(skillId);
  }

  @Post('rescan-all')
  async rescanAll(
    @Headers('x-api-key') apiKey: string,
    @Query('concurrency') concurrencyParam?: string,
  ) {
    if (apiKey !== INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }
    const concurrency = Math.max(1, Math.min(parseInt(concurrencyParam || '5', 10) || 5, 20));

    const skills = await this.prisma.skill.findMany({
      select: { id: true, filePath: true, name: true, sourceRepo: true, sourcePath: true },
    });

    const rescan = async () => {
      const total = skills.length;
      let success = 0;
      let skipped = 0;
      let failed = 0;
      let processed = 0;

      this.logger.log(`[Rescan-All] Starting rescan of ${total} skills with concurrency=${concurrency}`);

      const processOne = async (skill: typeof skills[number], index: number) => {
        const progress = `[${index + 1}/${total}]`;
        try {
          if (skill.sourceRepo && skill.sourcePath) {
            const url = await this.buildGithubBlobUrl(skill.sourceRepo, skill.sourcePath);
            this.logger.log(`${progress} GitHub: ${skill.id} "${skill.name}" → ${url}`);
            await this.scanService.triggerScanByUrl(skill.id, url, 'github');
            success++;
          } else if (skill.filePath) {
            this.logger.log(`${progress} ZIP: ${skill.id} "${skill.name}" → ${skill.filePath}`);
            const content = await this.downloadSkillMdFromS3(skill.filePath);
            if (!content || content.trim().length === 0) {
              this.logger.warn(`${progress} SKIP (empty content): ${skill.id} "${skill.name}"`);
              skipped++;
              return;
            }
            await this.scanService.triggerScanByContent(skill.id, content);
            success++;
          } else {
            this.logger.warn(`${progress} SKIP (no source): ${skill.id} "${skill.name}"`);
            skipped++;
          }
        } catch (err) {
          this.logger.error(`${progress} FAIL: ${skill.id} "${skill.name}": ${err.message}`);
          failed++;
        } finally {
          processed++;
          if (processed % 50 === 0) {
            this.logger.log(`[Rescan-All] Progress: ${processed}/${total} (success=${success} skipped=${skipped} failed=${failed})`);
          }
        }
      };

      // 滑动窗口并发：维持 concurrency 个并行请求
      let cursor = 0;
      const workers: Promise<void>[] = [];
      const startNext = async (): Promise<void> => {
        while (cursor < skills.length) {
          const idx = cursor++;
          await processOne(skills[idx], idx);
        }
      };
      for (let i = 0; i < concurrency; i++) {
        workers.push(startNext());
      }
      await Promise.all(workers);

      this.logger.log(`[Rescan-All] DONE: ${success} success, ${skipped} skipped, ${failed} failed out of ${total}`);
    };
    setImmediate(() => rescan());

    return { message: `Re-scan triggered for ${skills.length} skills (concurrency=${concurrency})` };
  }

  private branchCache = new Map<string, string>();

  private async getDefaultBranch(sourceRepo: string): Promise<string> {
    const cached = this.branchCache.get(sourceRepo);
    if (cached) return cached;

    let defaultBranch = 'main';
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SafuSkill-Bot',
      };
      const token = process.env.GITHUB_USER_TOKEN;
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`https://api.github.com/repos/${sourceRepo}`, { headers });
      if (res.ok) {
        const data = await res.json();
        defaultBranch = data.default_branch || 'main';
      }
    } catch {}
    this.branchCache.set(sourceRepo, defaultBranch);
    return defaultBranch;
  }

  private async buildGithubBlobUrl(sourceRepo: string, sourcePath: string): Promise<string> {
    const defaultBranch = await this.getDefaultBranch(sourceRepo);
    const sp = sourcePath.toLowerCase().endsWith('skill.md')
      ? sourcePath
      : `${sourcePath}/SKILL.md`;
    return `https://github.com/${sourceRepo}/blob/${defaultBranch}/${sp}`;
  }

  private async downloadSkillMdFromS3(filePath: string): Promise<string> {
    const s3Obj = await this.s3.getFile(filePath);
    const bodyStream = s3Obj.Body;
    if (!bodyStream) throw new Error('S3 returned empty body');

    const chunks: Buffer[] = [];
    for await (const chunk of bodyStream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const ext = filePath.toLowerCase().split('.').pop();
    if (ext === 'zip') {
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
}
