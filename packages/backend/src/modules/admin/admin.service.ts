import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { SkillsService } from '../skills/skills.service';

@Injectable()
export class AdminService {
  private adminUserIds: string[];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private skillsService: SkillsService,
  ) {
    const ids = this.config.get<string>('ADMIN_USER_IDS') || '';
    this.adminUserIds = ids.split(',').map((s) => s.trim()).filter(Boolean);
  }

  isAdmin(userId: string): boolean {
    return this.adminUserIds.includes(userId);
  }

  assertAdmin(userId: string) {
    if (!this.isAdmin(userId)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  async getFeatured() {
    return this.prisma.featuredSkill.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addFeatured(userId: string, sourceRepo: string, sourcePath: string, sortOrder = 0) {
    this.assertAdmin(userId);

    const skill = await this.prisma.skill.findUnique({ 
      where: { 
        sourceRepo_sourcePath: { sourceRepo, sourcePath } 
      } 
    });
    if (!skill) throw new NotFoundException('Skill not found');

    const existing = await this.prisma.featuredSkill.findUnique({ 
      where: { 
        sourceRepo_sourcePath: { sourceRepo, sourcePath } 
      } 
    });
    if (existing) throw new BadRequestException('Skill is already featured');

    const result = await this.prisma.featuredSkill.create({
      data: { sourceRepo, sourcePath, sortOrder },
    });
    
    // Clear skills cache when featured list changes
    this.skillsService.clearSkillsCache();
    
    return result;
  }

  async removeFeatured(userId: string, id: string) {
    this.assertAdmin(userId);

    const featured = await this.prisma.featuredSkill.findUnique({ where: { id } });
    if (!featured) throw new NotFoundException('Featured skill not found');

    const result = await this.prisma.featuredSkill.delete({ where: { id } });
    
    // Clear skills cache when featured list changes
    this.skillsService.clearSkillsCache();
    
    return result;
  }

  async updateFeaturedOrder(userId: string, id: string, sortOrder: number) {
    this.assertAdmin(userId);

    const featured = await this.prisma.featuredSkill.findUnique({ where: { id } });
    if (!featured) throw new NotFoundException('Featured skill not found');

    const result = await this.prisma.featuredSkill.update({
      where: { id },
      data: { sortOrder },
    });
    
    // Clear skills cache when featured order changes
    this.skillsService.clearSkillsCache();
    
    return result;
  }

  /** Public: get featured skill IDs for marketplace */
  async getFeaturedIds(): Promise<string[]> {
    const featured = await this.prisma.featuredSkill.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    
    // Query skills by sourceRepo + sourcePath to get IDs
    const skills = await Promise.all(
      featured.map(f => 
        this.prisma.skill.findUnique({
          where: { 
            sourceRepo_sourcePath: { 
              sourceRepo: f.sourceRepo, 
              sourcePath: f.sourcePath 
            } 
          },
          select: { id: true }
        })
      )
    );
    
    return skills.filter(s => s !== null).map(s => s.id);
  }

  /** Clear skills cache (for manual database changes) */
  clearSkillsCache(): void {
    this.skillsService.clearSkillsCache();
  }
}
