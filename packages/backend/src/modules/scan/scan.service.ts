import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AgentGuardAdapter } from './agentguard.adapter';
import * as path from 'path';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as os from 'os';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private prisma: PrismaService,
    private agentGuard: AgentGuardAdapter,
  ) {}

  /**
   * Scan using raw SKILL.md content (for zip uploads).
   * Calls AgentGuard /api/v1/scan directly with content string.
   */
  async triggerScanByContent(skillId: string, content: string) {
    this.logger.log(`[ScanByContent] START skillId=${skillId} contentLength=${content.length}`);
    const existing = await this.prisma.scanResult.findUnique({ where: { skillId }, select: { status: true } });
    await this.prisma.scanResult.upsert({
      where: { skillId },
      create: { skillId, status: 'SCANNING' },
      update: { status: 'SCANNING' },
    });

    try {
      const result = await this.agentGuard.scanContent(content);
      this.logger.log(`[ScanByContent] OK skillId=${skillId} riskLevel=${result.riskLevel} riskScore=${result.riskScore} safeToUse=${result.safeToUse}`);

      await this.prisma.scanResult.update({
        where: { skillId },
        data: {
          status: 'COMPLETED',
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          safeToUse: result.safeToUse,
          scanSummary: result.summary,
          scanDetails: result.details,
        },
      });
      this.logger.log(`[ScanByContent] SAVED skillId=${skillId}`);
    } catch (err) {
      this.logger.error(`[ScanByContent] FAILED skillId=${skillId}: ${err.message}`);
      const rollbackStatus = existing?.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
      await this.prisma.scanResult.update({
        where: { skillId },
        data: { status: rollbackStatus },
      }).catch((e) => this.logger.error(`[ScanByContent] Failed to rollback status: ${e.message}`));
    }
  }

  /**
   * Scan a skill by URL (preferred for GitHub-crawled skills).
   * Sends the SKILL.md GitHub URL to AgentGuard scan-url endpoint.
   */
  async triggerScanByUrl(skillId: string, url: string, type?: string) {
    this.logger.log(`[ScanByUrl] START skillId=${skillId} url=${url} type=${type || 'default'}`);
    const existing = await this.prisma.scanResult.findUnique({ where: { skillId }, select: { status: true } });
    await this.prisma.scanResult.upsert({
      where: { skillId },
      create: { skillId, status: 'SCANNING' },
      update: { status: 'SCANNING' },
    });

    try {
      const result = await this.agentGuard.scanUrl(url, type);
      this.logger.log(`[ScanByUrl] OK skillId=${skillId} riskLevel=${result.riskLevel} riskScore=${result.riskScore} safeToUse=${result.safeToUse}`);

      await this.prisma.scanResult.update({
        where: { skillId },
        data: {
          status: 'COMPLETED',
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          safeToUse: result.safeToUse,
          scanSummary: result.summary,
          scanDetails: result.details,
        },
      });
      this.logger.log(`[ScanByUrl] SAVED skillId=${skillId}`);
    } catch (err) {
      this.logger.error(`[ScanByUrl] FAILED skillId=${skillId}: ${err.message}`);
      const rollbackStatus = existing?.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
      await this.prisma.scanResult.update({
        where: { skillId },
        data: { status: rollbackStatus },
      }).catch((e) => this.logger.error(`[ScanByUrl] Failed to rollback status: ${e.message}`));
    }
  }

  /**
   * Scan a skill by extracting local file and sending content.
   * Used for user-uploaded skills.
   */
  async triggerScan(skillId: string, filePath: string) {
    await this.prisma.scanResult.upsert({
      where: { skillId },
      create: { skillId, status: 'SCANNING' },
      update: { status: 'SCANNING' },
    });

    try {
      const scanDir = await this.extractToTempDir(skillId, filePath);
      const result = await this.agentGuard.scan(scanDir);

      await this.prisma.scanResult.update({
        where: { skillId },
        data: {
          status: 'COMPLETED',
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          safeToUse: result.safeToUse,
          scanSummary: result.summary,
          scanDetails: result.details,
        },
      });

      this.cleanupTempDir(scanDir);
    } catch (err) {
      this.logger.error(`Scan failed for skill ${skillId}: ${err.message}`);
      await this.prisma.scanResult.update({
        where: { skillId },
        data: { status: 'FAILED' },
      });
    }
  }

  private async extractToTempDir(skillId: string, filePath: string): Promise<string> {
    const isUrl = filePath.startsWith('http');
    const tempDir = path.join(os.tmpdir(), `safuskill_scan_${skillId}_${Date.now()}`);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let localFilePath: string;

    if (isUrl) {
      // Download from S3 URL to local temp file
      const filename = path.basename(new URL(filePath).pathname) || 'download.zip';
      localFilePath = path.join(tempDir, filename);
      
      this.logger.log(`Downloading file from S3: ${filePath}`);
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(localFilePath, Buffer.from(buffer));
    } else {
      // Use local file path
      localFilePath = filePath;
    }

    const ext = path.extname(localFilePath).toLowerCase();
    const extractDir = path.join(tempDir, 'extracted');
    
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    if (ext === '.zip') {
      const buffer = fs.readFileSync(localFilePath);
      const directory = await unzipper.Open.buffer(buffer);
      const resolvedExtractDir = path.resolve(extractDir) + path.sep;

      for (const entry of directory.files) {
        const fullPath = path.resolve(extractDir, entry.path);
        if (!fullPath.startsWith(resolvedExtractDir)) {
          this.logger.warn(`Zip Slip blocked: ${entry.path}`);
          continue;
        }
        if (entry.type === 'Directory') {
          fs.mkdirSync(fullPath, { recursive: true });
        } else if (entry.type === 'File') {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          const content = await entry.buffer();
          fs.writeFileSync(fullPath, content);
        }
      }
    } else {
      fs.copyFileSync(localFilePath, path.join(extractDir, path.basename(localFilePath)));
    }

    return extractDir;
  }

  private cleanupTempDir(dir: string) {
    try {
      // Clean up the parent temp directory (which contains both downloaded file and extracted contents)
      const parentDir = path.dirname(dir);
      if (parentDir.includes(`safuskill_scan_`)) {
        fs.rmSync(parentDir, { recursive: true, force: true });
        this.logger.log(`Cleaned up temp directory: ${parentDir}`);
      } else {
        // Fallback to cleaning just the extracted directory
        fs.rmSync(dir, { recursive: true, force: true });
        this.logger.log(`Cleaned up directory: ${dir}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp directory: ${error.message}`);
    }
  }

  getScanResult(skillId: string) {
    return this.prisma.scanResult.findUnique({ where: { skillId } });
  }
}
