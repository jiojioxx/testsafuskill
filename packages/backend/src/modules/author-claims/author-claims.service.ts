import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthorClaimsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a claim:
   * - GitHub 来源 skill: githubLogin == authorName 即自动 VERIFIED
   * - ZIP 来源 skill: 不在此接口处理，用户走 disputes 提交申请，管理员审核后手动建 claim
   */
  async createClaim(userId: string, skillId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException('Skill not found');

    const existing = await this.prisma.authorClaim.findUnique({ where: { skillId } });
    if (existing) {
      throw new BadRequestException('This skill has already been claimed');
    }

    // ZIP 来源：不再通过 claims 接口，引导用户走 disputes
    if (!skill.sourceRepo) {
      throw new BadRequestException('Please submit a dispute to claim authorship for ZIP-uploaded skills');
    }

    // GitHub 来源：githubLogin == authorName 即自动通过
    if (!user.githubLogin || !skill.authorName ||
        user.githubLogin.toLowerCase() !== skill.authorName.toLowerCase()) {
      throw new ForbiddenException('Only the GitHub repo author can claim this skill');
    }

    return this.prisma.authorClaim.create({
      data: {
        userId,
        skillId,
        status: 'VERIFIED',
        githubUsername: skill.authorName,
        sourceRepo: skill.sourceRepo,
        verifiedAt: new Date(),
        ...(user.walletAddress && { beneficiaryAddress: user.walletAddress.toLowerCase() }),
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        skill: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * @deprecated GitHub 仓库权限校验已不再使用；保留方法以备需要回退。
   */
  private async verifyGitHubRepoAccess(
    accessToken: string,
    sourceRepo: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/repos/${sourceRepo}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data.permissions?.push === true || data.permissions?.admin === true;
    } catch {
      return false;
    }
  }

  async findBySkillId(skillId: string) {
    return this.prisma.authorClaim.findUnique({
      where: { skillId },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.authorClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: { select: { id: true, name: true, sourceRepo: true } },
      },
    });
  }

  async updateBeneficiary(id: string, userId: string, beneficiaryAddress: string) {
    const claim = await this.prisma.authorClaim.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.userId !== userId) throw new ForbiddenException('Only Auther Can Do');

    return this.prisma.authorClaim.update({
      where: { id },
      data: { beneficiaryAddress: beneficiaryAddress.toLowerCase() },
    });
  }
}
