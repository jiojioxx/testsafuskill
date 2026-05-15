import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';

/**
 * Composite scoring engine for skills.
 * Computes a 0-100 score using weighted signals:
 *   stars (20%), downloads (15%), security (20%), recency (15%),
 *   quality (15%), description (10%), category bonus (5%)
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private prisma: PrismaService) {}

  /** Recalculate scores every 6 hours */
  @Cron('0 30 */6 * * *')
  async handleScoreCron() {
    await this.scoreAll();
  }

  async scoreAll() {
    this.logger.log('Recalculating skill scores...');

    const skills = await this.prisma.skill.findMany({
      include: { scanResult: true },
    });

    // Compute max values for normalization
    const maxStars = Math.max(1, ...skills.map((s) => s.stars || 0));
    const maxDownloads = Math.max(1, ...skills.map((s) => s.downloadCount));

    let updated = 0;
    for (const skill of skills) {
      const score = this.computeScore(skill, maxStars, maxDownloads);
      await this.prisma.skill.update({
        where: { id: skill.id },
        data: { score },
      });
      updated++;
    }

    this.logger.log(`Scored ${updated} skills`);
  }

  computeScore(
    skill: any,
    maxStars: number,
    maxDownloads: number,
  ): number {
    const weights = {
      stars: 0.20,
      downloads: 0.15,
      security: 0.20,
      recency: 0.15,
      quality: 0.15,
      description: 0.10,
      categoryBonus: 0.05,
    };

    // 1. Stars (log-normalized)
    const starsScore = maxStars > 0
      ? Math.log1p(skill.stars || 0) / Math.log1p(maxStars)
      : 0;

    // 2. Downloads (log-normalized)
    const downloadsScore = maxDownloads > 0
      ? Math.log1p(skill.downloadCount) / Math.log1p(maxDownloads)
      : 0;

    // 3. Security (inverted risk score, 0 risk = 100% security)
    let securityScore = 0.5; // default if no scan
    if (skill.scanResult?.status === 'COMPLETED' && skill.scanResult?.riskScore != null) {
      securityScore = (100 - skill.scanResult.riskScore) / 100;
    }

    // 4. Recency (exponential decay, half-life ~60 days)
    const ageMs = Date.now() - new Date(skill.lastCommitAt || skill.updatedAt || skill.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-0.01 * ageDays);

    // 5. Quality score (from quality analyzer, 0-1)
    const qualityVal = skill.qualityScore || 0;

    // 6. Description quality
    const desc = skill.description || '';
    const descScore = Math.min(1, desc.length / 200); // 200+ chars = full score

    // 7. Category bonus (known categories get a boost)
    const knownCategories = ['BNBChain Skills', 'MCP Skills', 'DeFi Skills', 'Security Skills'];
    const categoryBonus = knownCategories.includes(skill.category || '') ? 1 : 0.5;

    const raw =
      weights.stars * starsScore +
      weights.downloads * downloadsScore +
      weights.security * securityScore +
      weights.recency * recencyScore +
      weights.quality * qualityVal +
      weights.description * descScore +
      weights.categoryBonus * categoryBonus;

    return Math.round(raw * 100 * 100) / 100; // 0-100 with 2 decimals
  }
}
