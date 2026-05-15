import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Multi-dimensional quality analyzer for skills.
 * Evaluates: completeness, clarity, agent-readiness, examples, description quality.
 * Returns a 0-1 quality score.
 */
@Injectable()
export class QualityAnalyzerService {
  private readonly logger = new Logger(QualityAnalyzerService.name);

  constructor(private prisma: PrismaService) {}

  /** Analyze quality for a single skill and persist the score */
  async analyzeAndSave(skillId: string): Promise<number> {
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) return 0;

    const score = this.analyze(skill);

    await this.prisma.skill.update({
      where: { id: skillId },
      data: { qualityScore: score },
    });

    return score;
  }

  /** Analyze all skills */
  async analyzeAll() {
    const skills = await this.prisma.skill.findMany();
    this.logger.log(`Analyzing quality for ${skills.length} skills...`);

    for (const skill of skills) {
      const score = this.analyze(skill);
      await this.prisma.skill.update({
        where: { id: skill.id },
        data: { qualityScore: score },
      });
    }

    this.logger.log('Quality analysis complete');
  }

  /** Compute quality score (0-1) from skill data */
  analyze(skill: any): number {
    const weights = {
      completeness: 0.20,
      clarity: 0.15,
      agentReadiness: 0.25,
      examples: 0.15,
      metadata: 0.15,
      maintenance: 0.10,
    };

    // 1. Completeness — description length, has topics, has language
    const desc = skill.description || '';
    const descLen = desc.length;
    const descCompleteness = descLen >= 500 ? 1 : descLen >= 200 ? 0.7 : descLen >= 50 ? 0.4 : 0.1;
    const hasTopics = skill.topics ? JSON.parse(skill.topics).length > 0 : false;
    const hasLanguage = !!skill.language;
    const completeness = (descCompleteness * 0.5) + (hasTopics ? 0.3 : 0) + (hasLanguage ? 0.2 : 0);

    // 2. Clarity — description is focused, not too short, not too long
    const clarityByLen = descLen >= 100 && descLen <= 2000 ? 1 : descLen > 2000 ? 0.7 : descLen / 100;
    const hasCodeBlocks = desc.includes('```') || desc.includes('`');
    const clarity = clarityByLen * 0.7 + (hasCodeBlocks ? 0.3 : 0);

    // 3. Agent Readiness — keywords indicating skill/MCP/agent compatibility
    const agentKeywords = ['mcp', 'skill', 'agent', 'tool', 'plugin', 'api', 'endpoint', 'install', 'usage', 'config'];
    const descLower = desc.toLowerCase();
    const topicsLower = (skill.topics || '').toLowerCase();
    const nameLower = (skill.name || '').toLowerCase();
    const combined = `${descLower} ${topicsLower} ${nameLower}`;
    const agentMatches = agentKeywords.filter((kw) => combined.includes(kw)).length;
    const agentReadiness = Math.min(1, agentMatches / 4);

    // 4. Examples — code blocks, step-by-step instructions
    const codeBlockCount = (desc.match(/```/g) || []).length / 2;
    const hasSteps = /\d\.\s/.test(desc) || desc.includes('- ');
    const examples = Math.min(1, codeBlockCount * 0.3 + (hasSteps ? 0.4 : 0));

    // 5. Metadata richness — stars, category, source repo
    const hasStars = (skill.stars || 0) > 0;
    const hasCategory = !!skill.category;
    const hasRepo = !!skill.sourceRepo;
    const metadata = (hasStars ? 0.4 : 0) + (hasCategory ? 0.3 : 0) + (hasRepo ? 0.3 : 0);

    // 6. Maintenance — recent commits
    let maintenance = 0.3; // default
    if (skill.lastCommitAt) {
      const ageMs = Date.now() - new Date(skill.lastCommitAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      maintenance = ageDays < 30 ? 1 : ageDays < 90 ? 0.7 : ageDays < 365 ? 0.4 : 0.2;
    }

    const score =
      weights.completeness * completeness +
      weights.clarity * clarity +
      weights.agentReadiness * agentReadiness +
      weights.examples * examples +
      weights.metadata * metadata +
      weights.maintenance * maintenance;

    return Math.round(score * 100) / 100;
  }
}
