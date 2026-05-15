import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTokenDto } from './dto/create-token.dto';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTokenDto) {
    this.logger.log(`Creating token draft: user=${userId} skill=${dto.skillId} symbol=${dto.symbol}`);
    const skill = await this.prisma.skill.findUnique({
      where: { id: dto.skillId },
      include: {
        authorClaim: { select: { userId: true, status: true, beneficiaryAddress: true } },
        tokenLaunches: { where: { status: { in: ['ACTIVE', 'DEPLOYING'] } }, select: { id: true }, take: 1 },
      },
    });

    if (!skill) throw new NotFoundException('Skill not found');

    if (skill.tokenLaunches.length > 0) {
      this.logger.warn(`Skill ${dto.skillId} already has an active token launch`);
      throw new BadRequestException('This skill already has an active token');
    }

    const isOwner = skill.userId === userId && !skill.sourceRepo;
    const isClaimed = skill.authorClaim?.userId === userId && skill.authorClaim.status === 'VERIFIED';

    let isGithubAuthor = false;
    let authorUser: { githubLogin: string | null; walletAddress: string | null } | null = null;
    if (!isClaimed && skill.sourceRepo && skill.authorName) {
      authorUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { githubLogin: true, walletAddress: true } });
      if (authorUser?.githubLogin) {
        isGithubAuthor = authorUser.githubLogin.toLowerCase() === skill.authorName.toLowerCase();
      }
    }

    // 自动建 claim / 填受益地址
    // - GitHub 作者匹配：自动 VERIFIED
    // - ZIP 上传：不再自动认证，需走人工申请（createClaim）
    if (isClaimed || isGithubAuthor) {
      let authorWalletAddress: string | null = null;
      if (isClaimed) {
        const claimOwner = await this.prisma.user.findUnique({ where: { id: skill.authorClaim!.userId }, select: { walletAddress: true } });
        authorWalletAddress = claimOwner?.walletAddress ?? null;
      } else if (isGithubAuthor) {
        authorWalletAddress = authorUser?.walletAddress ?? null;
      }

      if (isGithubAuthor && !skill.authorClaim) {
        await this.prisma.authorClaim.create({
          data: {
            userId,
            skillId: dto.skillId,
            status: 'VERIFIED',
            githubUsername: authorUser!.githubLogin!,
            sourceRepo: skill.sourceRepo!,
            verifiedAt: new Date(),
            ...(authorWalletAddress && { beneficiaryAddress: authorWalletAddress }),
          },
        }).catch(() => {});
      } else if (skill.authorClaim && !skill.authorClaim.beneficiaryAddress && authorWalletAddress) {
        const claim = await this.prisma.authorClaim.findUnique({ where: { skillId: dto.skillId }, select: { id: true, beneficiaryAddress: true } });
        if (claim && !claim.beneficiaryAddress) {
          await this.prisma.authorClaim.update({
            where: { id: claim.id },
            data: { beneficiaryAddress: authorWalletAddress },
          }).catch(() => {});
        }
      }
    }
    void isOwner;

    return this.prisma.tokenLaunch.create({
      data: {
        userId,
        name: dto.name,
        symbol: dto.symbol,
        description: dto.description,
        skillId: dto.skillId,
        imageUrl: dto.imageUrl,
        chainId: dto.chainId ?? 56,
        // 固定 1% 协议税，全部进入国库 Tax Splitter
        taxRate: 100,
        mktBps: 10000,
        deflationBps: 0,
        dividendBps: 0,
        lpBps: 0,
        website: dto.website,
        twitter: dto.twitter,
        launchPlatform: dto.launchPlatform || 'FLAP',
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        skill: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(limit = 20, page = 1, sortBy = 'newest') {
    let orderBy: any = { createdAt: 'desc' };

    if (sortBy === 'most_used') {
      orderBy = { skill: { downloadCount: 'desc' } };
    }

    const where = { status: { in: ['ACTIVE', 'DEPLOYING'] } };
    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      this.prisma.tokenLaunch.findMany({
        where,
        orderBy,
        take: limit,
        skip,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          skill: { select: { id: true, name: true, downloadCount: true } },
        },
      }),
      this.prisma.tokenLaunch.count({ where }),
    ]);

    return { tokens, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, currentUserId?: string) {
    const token = await this.prisma.tokenLaunch.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        skill: {
          select: {
            id: true, name: true, description: true, authorName: true, repoUrl: true, sourceRepo: true, userId: true,
            downloadCount: true, language: true, stars: true, platforms: true, category: true,
            authorClaim: {
              select: { id: true, status: true, githubUsername: true, beneficiaryAddress: true, verifiedAt: true, user: { select: { id: true, username: true, avatarUrl: true } } },
            },
          },
        },
      },
    });
    if (!token) throw new NotFoundException('Token launch not found');

    // 自动为 GitHub 来源 skill 匹配作者身份（currentUser.githubLogin == skill.authorName）
    if (
      currentUserId &&
      token.skill?.sourceRepo &&
      token.skill.authorName &&
      !token.skill.authorClaim
    ) {
      const user = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: { githubLogin: true, walletAddress: true },
      });
      if (user?.githubLogin && user.githubLogin.toLowerCase() === token.skill.authorName.toLowerCase()) {
        const created = await this.prisma.authorClaim.create({
          data: {
            userId: currentUserId,
            skillId: token.skill.id,
            status: 'VERIFIED',
            githubUsername: token.skill.authorName,
            sourceRepo: token.skill.sourceRepo,
            verifiedAt: new Date(),
            ...(user.walletAddress && { beneficiaryAddress: user.walletAddress.toLowerCase() }),
          },
          select: {
            id: true, status: true, githubUsername: true, beneficiaryAddress: true, verifiedAt: true,
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        }).catch(() => null);
        if (created) {
          (token.skill as any).authorClaim = created;
        }
      }
    }

    return token;
  }

  async findByUser(userId: string) {
    return this.prisma.tokenLaunch.findMany({
      where: {
        userId,
        status: { not: 'DRAFT' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: { select: { id: true, name: true } },
      },
    });
  }

  async markDeployed(id: string, userId: string, tokenAddress: string, txHash: string, imageUrl?: string, deployBlockNumber?: bigint) {
    const token = await this.prisma.tokenLaunch.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token launch not found');
    if (token.userId !== userId) throw new NotFoundException('Token launch not found');

    this.logger.log(`Token deployed: id=${id} address=${tokenAddress} tx=${txHash}`);

    return this.prisma.tokenLaunch.update({
      where: { id },
      data: {
        tokenAddress,
        txHash,
        status: 'ACTIVE',
        ...(imageUrl && { imageUrl }),
        ...(deployBlockNumber != null && { deployBlockNumber }),
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        skill: { select: { id: true, name: true } },
      },
    });
  }

  async markDeploying(id: string, userId: string, txHash: string) {
    const token = await this.prisma.tokenLaunch.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token launch not found');
    if (token.userId !== userId) throw new NotFoundException('Token launch not found');

    return this.prisma.tokenLaunch.update({
      where: { id },
      data: { txHash, status: 'DEPLOYING' },
    });
  }

  async markFailed(id: string, userId: string) {
    const token = await this.prisma.tokenLaunch.findUnique({ where: { id } });
    if (!token) throw new NotFoundException('Token launch not found');
    if (token.userId !== userId) throw new NotFoundException('Token launch not found');

    return this.prisma.tokenLaunch.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }

  /**
   * Get recent platform activity for the global feed.
   * Returns a mix of recent token launches and comments.
   */
  async getFeed(limit = 20) {
    const [launches, comments] = await Promise.all([
      this.prisma.tokenLaunch.findMany({
        where: { status: { in: ['ACTIVE', 'DEPLOYING'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, name: true, symbol: true, status: true, createdAt: true,
          user: { select: { username: true, walletAddress: true } },
          skill: { select: { name: true } },
        },
      }),
      this.prisma.comment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, content: true, createdAt: true,
          user: { select: { username: true, walletAddress: true } },
          tokenLaunch: { select: { id: true, symbol: true } },
        },
      }),
    ]);

    // Merge and sort by time
    const feed = [
      ...launches.map((l) => ({
        type: 'launch' as const,
        id: l.id,
        message: `launched $${l.symbol}${l.skill ? ` for ${l.skill.name}` : ''}`,
        user: l.user.walletAddress ? `${l.user.walletAddress.slice(0, 6)}...${l.user.walletAddress.slice(-4)}` : l.user.username,
        tokenId: l.id,
        symbol: l.symbol,
        createdAt: l.createdAt,
      })),
      ...comments.map((c) => ({
        type: 'comment' as const,
        id: c.id,
        message: c.content.length > 60 ? c.content.slice(0, 60) + '...' : c.content,
        user: c.user.walletAddress ? `${c.user.walletAddress.slice(0, 6)}...${c.user.walletAddress.slice(-4)}` : c.user.username,
        tokenId: c.tokenLaunch.id,
        symbol: c.tokenLaunch.symbol,
        createdAt: c.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);

    return feed;
  }
}
