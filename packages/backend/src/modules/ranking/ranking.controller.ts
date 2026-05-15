import { Controller, Get, Post, Put, Body, Param, Query, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../common/prisma.service';

@Controller()
export class RankingController {
  constructor(private prisma: PrismaService) {}

  /** Trending skills — highest star velocity (stars / age in days) */
  @Get('trending')
  async getTrending(@Query('days') days?: string, @Query('limit') limit?: string) {
    const dayWindow = Math.min(parseInt(days || '30', 10), 90);
    const take = Math.min(parseInt(limit || '20', 10), 50);

    const skills = await this.prisma.skill.findMany({
      where: {
        stars: { gt: 0 },
        createdAt: { gte: new Date(Date.now() - dayWindow * 86400000) },
      },
      orderBy: { stars: 'desc' },
      take: take * 2, // fetch extra, re-rank by velocity
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });

    // Compute velocity and sort
    const ranked = skills
      .map((s) => {
        const ageDays = Math.max(1, (Date.now() - new Date(s.createdAt).getTime()) / 86400000);
        return { ...s, velocity: (s.stars || 0) / ageDays };
      })
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, take);

    return ranked;
  }

  /** Rising skills — recently created, sorted by stars */
  @Get('rising')
  async getRising(@Query('days') days?: string, @Query('limit') limit?: string) {
    const dayWindow = Math.min(parseInt(days || '14', 10), 90);
    const take = Math.min(parseInt(limit || '20', 10), 50);

    return this.prisma.skill.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - dayWindow * 86400000) },
      },
      orderBy: { stars: 'desc' },
      take,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });
  }

  /** Top-rated skills — highest composite score */
  @Get('top-rated')
  async getTopRated(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('category') category?: string) {
    const take = Math.min(parseInt(limit || '20', 10), 100);
    const skip = Math.max(parseInt(offset || '0', 10), 0);

    const where: any = {};
    if (category) where.category = category;

    return this.prisma.skill.findMany({
      where,
      orderBy: { score: 'desc' },
      take,
      skip,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });
  }

  /** Most starred skills — established favorites */
  @Get('most-starred')
  async getMostStarred(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('category') category?: string) {
    const take = Math.min(parseInt(limit || '20', 10), 100);
    const skip = Math.max(parseInt(offset || '0', 10), 0);

    const where: any = {};
    if (category) {
      where.category = category;
    }

    return this.prisma.skill.findMany({
      where,
      orderBy: { stars: 'desc' },
      take,
      skip,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });
  }

  /** Recently updated skills */
  @Get('recently-updated')
  async getRecentlyUpdated(@Query('limit') limit?: string, @Query('offset') offset?: string, @Query('category') category?: string) {
    const take = Math.min(parseInt(limit || '20', 10), 100);
    const skip = Math.max(parseInt(offset || '0', 10), 0);

    const where: any = {};
    if (category) where.category = category;

    return this.prisma.skill.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        scanResult: { select: { status: true, riskLevel: true, safeToUse: true } },
      },
    });
  }

  /** Landing page — bundled data in a single request */
  @Get('landing-data')
  async getLandingData() {
    const [
      total,
      trending,
      topRated,
      recentlyUpdated,
      categories,
      languages,
    ] = await Promise.all([
      this.prisma.skill.count(),
      // Trending (top 8 by stars, recent)
      this.prisma.skill.findMany({
        where: { stars: { gt: 0 } },
        orderBy: { stars: 'desc' },
        take: 8,
        include: {
          user: { select: { username: true } },
          scanResult: { select: { riskLevel: true, safeToUse: true } },
        },
      }),
      // Top rated (top 8 by score)
      this.prisma.skill.findMany({
        orderBy: { score: 'desc' },
        take: 8,
        include: {
          user: { select: { username: true } },
          scanResult: { select: { riskLevel: true, safeToUse: true } },
        },
      }),
      // Recently updated (top 8)
      this.prisma.skill.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: {
          user: { select: { username: true } },
          scanResult: { select: { riskLevel: true, safeToUse: true } },
        },
      }),
      // Category counts
      this.prisma.skill.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
      // Language distribution
      this.prisma.skill.groupBy({
        by: ['language'],
        _count: true,
        where: { language: { not: null } },
        orderBy: { _count: { language: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      stats: {
        total,
        categories: categories.map((c) => ({
          name: c.category || 'Uncategorized',
          count: c._count,
        })),
        languages: languages.map((l) => ({
          name: l.language,
          count: l._count,
        })),
      },
      trending,
      topRated,
      recentlyUpdated,
    };
  }

  /** Submit a skill (community suggestion) */
  @Post('submit-skill')
  @HttpCode(201)
  async submitSkill(@Body() body: { repoUrl: string; submittedBy?: string }) {
    const { repoUrl, submittedBy } = body;

    if (!repoUrl || !repoUrl.includes('github.com/')) {
      return { success: false, message: 'Invalid GitHub repository URL' };
    }

    // Check duplicates
    const existing = await this.prisma.skillSubmission.findFirst({
      where: { repoUrl },
    });
    if (existing) {
      return { success: false, message: 'This repository has already been submitted', status: existing.status };
    }

    // Also check if already indexed
    const repoMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (repoMatch) {
      const indexed = await this.prisma.skill.findFirst({
        where: { sourceRepo: repoMatch[1] },
      });
      if (indexed) {
        return { success: false, message: 'This repository is already indexed in SafuSkill' };
      }
    }

    const submission = await this.prisma.skillSubmission.create({
      data: { repoUrl, submittedBy },
    });

    return { success: true, id: submission.id, message: 'Skill submitted for review' };
  }

  /** List pending submissions (admin) */
  @Get('submissions')
  async listSubmissions(@Query('status') status?: string) {
    const where = status ? { status: status as any } : {};
    return this.prisma.skillSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Approve/reject a submission (admin) */
  @Put('submissions/:id')
  async reviewSubmission(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string },
  ) {
    return this.prisma.skillSubmission.update({
      where: { id },
      data: {
        status: body.status,
        reviewNotes: body.reviewNotes,
      },
    });
  }

  /** Platform stats */
  @Get('platforms')
  async getPlatforms() {
    const skills = await this.prisma.skill.findMany({
      where: { platforms: { not: null } },
      select: { platforms: true },
    });

    const counts: Record<string, number> = {};
    for (const s of skills) {
      try {
        const platforms = JSON.parse(s.platforms || '[]');
        for (const p of platforms) {
          counts[p] = (counts[p] || 0) + 1;
        }
      } catch {}
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Sitemap XML for SEO */
  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response) {
    const skills = await this.prisma.skill.findMany({
      select: { id: true, score: true, updatedAt: true },
      orderBy: { score: 'desc' },
    });

    const baseUrl = process.env.FRONTEND_URL || 'https://safuskill.com';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Homepage
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <priority>1.0</priority>\n    <changefreq>daily</changefreq>\n  </url>\n`;

    // Marketplace
    xml += `  <url>\n    <loc>${baseUrl}/marketplace</loc>\n    <priority>0.9</priority>\n    <changefreq>daily</changefreq>\n  </url>\n`;

    // Skill pages
    for (const skill of skills) {
      const priority = (0.4 + ((skill.score || 0) / 100) * 0.5).toFixed(1);
      const lastmod = skill.updatedAt.toISOString().split('T')[0];
      xml += `  <url>\n    <loc>${baseUrl}/skills/${skill.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>\n`;
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }

  /** Global stats */
  @Get('stats')
  async getStats() {
    const [total, scanned, safe] = await Promise.all([
      this.prisma.skill.count(),
      this.prisma.scanResult.count({ where: { status: 'COMPLETED' } }),
      this.prisma.scanResult.count({ where: { safeToUse: true } }),
    ]);

    return { total, scanned, safePercentage: total > 0 ? Math.round((safe / Math.max(1, scanned)) * 100) : 0 };
  }
}
