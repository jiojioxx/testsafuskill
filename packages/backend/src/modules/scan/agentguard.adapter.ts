import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AdaptedScanResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  safeToUse: boolean;
  summary: string;
  details: object;
}

interface AgentGuardThreat {
  detector: string;
  severity: string;
  title: string;
  description: string;
  evidence?: string;
  line?: number;
  remediation?: string;
  cwe?: string;
}

interface AgentGuardData {
  scanId: string;
  riskScore: number;
  riskLevel: string;
  verdict: string;
  summary: string;
  threats: AgentGuardThreat[];
  permissions: {
    declared: string[];
    recommended: string[];
    riskDelta: string;
  };
  processingMs: number;
}

interface AgentGuardResponse {
  success: boolean;
  data: AgentGuardData;
  meta: {
    requestId: string;
    rateLimit: { limit: number; remaining: number; reset: number };
  };
}

const API_BASE = 'https://agentguard.gopluslabs.io';
const API_KEY = process.env.AGENTGUARD_API_KEY || 'ag_live_pKxh06AicDw1Hefxh8aEKqbbcK1LUvqB';

@Injectable()
export class AgentGuardAdapter {
  private readonly logger = new Logger(AgentGuardAdapter.name);

  /**
   * Scan using raw SKILL.md content string (for zip uploads).
   * Sends content directly to /api/v1/scan — no temp files needed.
   */
  async scanContent(content: string): Promise<AdaptedScanResult> {
    this.logger.log(`Scanning via AgentGuard /api/v1/scan (content length: ${content.length})`);

    try {
      const maxContentLength = 100_000;
      const truncated =
        content.length > maxContentLength
          ? content.slice(0, maxContentLength) + '\n// ... truncated'
          : content;

      const res = await fetch(`${API_BASE}/api/v1/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({ content: truncated }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AgentGuard API ${res.status}: ${errText}`);
      }

      return this.parseResponse(await res.json(), { scan_method: 'content_direct' });
    } catch (error) {
      this.logger.error(`AgentGuard scanContent failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan a skill by its GitHub URL (preferred for crawled skills).
   * Uses /api/v1/scan-url — AgentGuard fetches the content.
   */
  async scanUrl(url: string, type?: string): Promise<AdaptedScanResult> {
    this.logger.log(`Scanning URL via AgentGuard API: ${url} (type: ${type || 'default'})`);

    try {
      const payload: any = { url };
      if (type) {
        payload.type = type;
      }

      const res = await fetch(`${API_BASE}/api/v1/scan-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AgentGuard API ${res.status}: ${errText}`);
      }

      return this.parseResponse(await res.json(), { 
        scan_method: 'url', 
        url,
        type: type || 'github'
      });
    } catch (error) {
      this.logger.error(`AgentGuard scan-url failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan a skill by reading local files and sending content.
   * Uses /api/v1/scan — for user-uploaded skills.
   */
  async scan(dirPath: string): Promise<AdaptedScanResult> {
    this.logger.log(`Scanning directory via AgentGuard API: ${dirPath}`);

    try {
      const files = this.collectFiles(dirPath);

      if (files.length === 0) {
        this.logger.warn(`No scannable files found in ${dirPath}`);
        return {
          riskLevel: 'LOW',
          riskScore: 0,
          safeToUse: true,
          summary: 'No code files found to scan',
          details: { scan_type: 'agentguard_api', files_scanned: 0 },
        };
      }

      // Send SKILL.md content as primary, other files via files param
      const skillMd = files.find((f) => f.name.toLowerCase() === 'skill.md');
      const otherFiles = files.filter((f) => f.name.toLowerCase() !== 'skill.md');

      const content = skillMd
        ? skillMd.content
        : files.map((f) => `// === FILE: ${f.name} ===\n${f.content}`).join('\n\n');

      // Truncate if too large
      const maxContentLength = 100_000;
      const truncatedContent = content.length > maxContentLength
        ? content.slice(0, maxContentLength) + '\n// ... truncated'
        : content;

      const body: Record<string, unknown> = { content: truncatedContent };
      if (otherFiles.length > 0) {
        body.files = otherFiles.map((f) => ({ name: f.name, content: f.content }));
      }

      const res = await fetch(`${API_BASE}/api/v1/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AgentGuard API ${res.status}: ${errText}`);
      }

      return this.parseResponse(await res.json(), {
        scan_method: 'content',
        files_scanned: files.length,
      });
    } catch (error) {
      this.logger.error(`AgentGuard API scan failed: ${error.message}`);
      throw error;
    }
  }

  private parseResponse(response: AgentGuardResponse, extra: Record<string, unknown>): AdaptedScanResult {
    if (!response.success || !response.data) {
      throw new Error('AgentGuard API returned unsuccessful response');
    }

    const result = response.data;
    this.logger.log(
      `Scan complete: ${result.scanId} | risk=${result.riskLevel} | verdict=${result.verdict} | threats=${result.threats.length}`,
    );

    const riskLevel = this.mapRiskLevel(result.riskLevel);

    return {
      riskLevel,
      riskScore: result.riskScore,
      safeToUse: result.verdict === 'passed' || result.verdict === 'pass',
      summary: result.summary,
      details: {
        scan_id: result.scanId,
        scan_type: 'agentguard_api',
        verdict: result.verdict,
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        threats: result.threats,
        permissions: result.permissions,
        processing_ms: result.processingMs,
        ...extra,
      },
    };
  }

  private scanFallback(errorMessage: string): AdaptedScanResult {
    return {
      riskLevel: 'MEDIUM',
      riskScore: 50,
      safeToUse: false,
      summary: 'Security scan failed - manual review required',
      details: {
        error: errorMessage,
        scan_type: 'agentguard_api_failed',
      },
    };
  }

  private collectFiles(dirPath: string): Array<{ name: string; content: string }> {
    const files: Array<{ name: string; content: string }> = [];
    const exts = new Set([
      '.ts', '.js', '.py', '.json', '.yaml', '.yml', '.md',
      '.toml', '.cfg', '.sh', '.bash', '.zsh', '.dockerfile',
    ]);
    const maxFileSize = 512 * 1024;

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (exts.has(ext) || entry.name === 'Dockerfile') {
            const stat = fs.statSync(fullPath);
            if (stat.size <= maxFileSize) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const relativePath = path.relative(dirPath, fullPath);
              files.push({ name: relativePath, content });
            }
          }
        }
      }
    };

    walk(dirPath);
    return files;
  }

  private mapRiskLevel(level: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      safe: 'LOW',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };
    return map[level?.toLowerCase()] ?? 'MEDIUM';
  }
}
