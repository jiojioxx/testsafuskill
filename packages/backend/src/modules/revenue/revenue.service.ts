import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

function parseToWei(bnbStr: string): bigint {
  if (!bnbStr || bnbStr === '0') return 0n;
  const [intPart, decPart = ''] = bnbStr.split('.');
  const padded = (decPart + '000000000000000000').slice(0, 18);
  return BigInt(intPart + padded);
}

function weiToString(wei: bigint): string {
  if (wei === 0n) return '0';
  const s = wei.toString().padStart(19, '0');
  const int = s.slice(0, -18) || '0';
  const dec = s.slice(-18).replace(/0+$/, '');
  return dec ? `${int}.${dec}` : int;
}
// TODO: 测试需要修改 上线前改回0.1
const MIN_CLAIM_WEI = parseToWei('0.00001');

@Injectable()
export class RevenueService {
  constructor(private prisma: PrismaService) {}

  /**
   * 自动为当前用户匹配 GitHub 来源 skill 的作者身份：
   * 凡 skill.authorName == user.githubLogin 且尚无 authorClaim 的，
   * 一律 upsert 一条 VERIFIED 的 AuthorClaim（不再调用 GitHub API 校验仓库权限）。
   */
  private async ensureGithubClaims(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubLogin: true, walletAddress: true },
    });
    if (!user?.githubLogin) return;

    const candidates = await this.prisma.skill.findMany({
      where: {
        sourceRepo: { not: null },
        authorName: { not: null },
        authorClaim: null,
      },
      select: { id: true, sourceRepo: true, authorName: true },
    });

    const loginLower = user.githubLogin.toLowerCase();
    for (const skill of candidates) {
      if (!skill.authorName || skill.authorName.toLowerCase() !== loginLower) continue;
      await this.prisma.authorClaim.create({
        data: {
          userId,
          skillId: skill.id,
          status: 'VERIFIED',
          githubUsername: skill.authorName,
          sourceRepo: skill.sourceRepo!,
          verifiedAt: new Date(),
          ...(user.walletAddress && { beneficiaryAddress: user.walletAddress.toLowerCase() }),
        },
      }).catch(() => {});
    }
  }

  private computeDevRevenue(trades: { bnbAmount: string }[]): bigint {
    let total = 0n;
    for (const t of trades) {
      const wei = parseToWei(t.bnbAmount);
      total += wei * 7n / 1000n;
    }
    return total;
  }

  async getMyRevenue(userId: string) {
    await this.ensureGithubClaims(userId);

    const claims = await this.prisma.authorClaim.findMany({
      where: { userId, status: 'VERIFIED' },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: {
          select: {
            id: true, name: true, sourceRepo: true,
            tokenLaunches: {
              where: { status: 'ACTIVE', tokenAddress: { not: null } },
              select: { id: true, name: true, symbol: true, tokenAddress: true, imageUrl: true, launchPlatform: true },
              take: 1,
            },
          },
        },
        revenueClaims: { select: { claimedAmount: true, status: true, createdAt: true } },
      },
    });

    const result = [];
    for (const claim of claims) {
      const launch = claim.skill.tokenLaunches[0];
      if (!launch?.tokenAddress) {
        result.push({
          authorClaimId: claim.id,
          skillName: claim.skill.name,
          token: null,
          totalDevRevenue: '0',
          totalClaimed: '0',
          pendingAmount: '0',
          canClaimToday: false,
          lastClaimAt: null,
          _pendingWei: 0n,
          _createdAt: claim.createdAt,
        });
        continue;
      }

      const trades = await this.prisma.tokenTrade.findMany({
        where: { tokenAddress: launch.tokenAddress.toLowerCase() },
        select: { bnbAmount: true },
      });
      const totalDev = this.computeDevRevenue(trades);

      let totalClaimedWei = 0n;
      let lastClaimAt: Date | null = null;
      for (const rc of claim.revenueClaims) {
        totalClaimedWei += parseToWei(rc.claimedAmount);
        if (!lastClaimAt || rc.createdAt > lastClaimAt) lastClaimAt = rc.createdAt;
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const claimedToday = claim.revenueClaims.some(
        (rc) => rc.createdAt >= todayStart,
      );

      const pendingWei = totalDev - totalClaimedWei;
      result.push({
        authorClaimId: claim.id,
        skillName: claim.skill.name,
        token: launch ? { id: launch.id, name: launch.name, symbol: launch.symbol, tokenAddress: launch.tokenAddress, imageUrl: launch.imageUrl, launchPlatform: launch.launchPlatform } : null,
        totalDevRevenue: weiToString(totalDev),
        totalClaimed: weiToString(totalClaimedWei),
        pendingAmount: weiToString(pendingWei),
        canClaimToday: !claimedToday && pendingWei >= MIN_CLAIM_WEI,
        lastClaimAt,
        _pendingWei: pendingWei,
        _createdAt: claim.createdAt,
      });
    }

    result.sort((a, b) => {
      if (a._pendingWei !== b._pendingWei) return a._pendingWei > b._pendingWei ? -1 : 1;
      return b._createdAt.getTime() - a._createdAt.getTime();
    });

    return result.map(({ _pendingWei, _createdAt, ...rest }) => rest);
  }

  async claimRevenue(userId: string, authorClaimId: string) {
    const claim = await this.prisma.authorClaim.findUnique({
      where: { id: authorClaimId },
      include: {
        skill: {
          select: {
            tokenLaunches: {
              where: { status: 'ACTIVE', tokenAddress: { not: null } },
              select: { tokenAddress: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.userId !== userId) throw new ForbiddenException('Not your claim');
    if (claim.status !== 'VERIFIED') throw new BadRequestException('Claim not verified');

    const tokenAddress = claim.skill.tokenLaunches[0]?.tokenAddress?.toLowerCase();
    if (!tokenAddress) throw new BadRequestException('No active token for this skill');

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const existingToday = await this.prisma.revenueClaim.findFirst({
      where: { authorClaimId, createdAt: { gte: todayStart } },
    });
    if (existingToday) throw new BadRequestException('Already claimed today');

    const lastClaim = await this.prisma.revenueClaim.findFirst({
      where: { authorClaimId },
      orderBy: { createdAt: 'desc' },
      select: { lastTradeId: true },
    });
    const afterTradeId = lastClaim?.lastTradeId ?? 0n;

    const newTrades = await this.prisma.tokenTrade.findMany({
      where: { tokenAddress, id: { gt: afterTradeId } },
      select: { id: true, bnbAmount: true },
      orderBy: { id: 'asc' },
    });

    if (newTrades.length === 0) throw new BadRequestException('No new trades to claim');

    const devRevenue = this.computeDevRevenue(newTrades);
    if (devRevenue <= 0n) throw new BadRequestException('No revenue to claim');
    if (devRevenue < MIN_CLAIM_WEI) throw new BadRequestException('Minimum claim amount is 0.1 BNB');

    const lastTradeId = newTrades[newTrades.length - 1].id;

    return this.prisma.revenueClaim.create({
      data: {
        authorClaimId,
        tokenAddress,
        claimedAmount: weiToString(devRevenue),
        lastTradeId,
        tradeCount: newTrades.length,
        status: 'PENDING',
      },
    });
  }

  async getClaimHistory(userId: string, authorClaimId: string) {
    const claim = await this.prisma.authorClaim.findUnique({ where: { id: authorClaimId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.userId !== userId) throw new ForbiddenException('Not your claim');

    return this.prisma.revenueClaim.findMany({
      where: { authorClaimId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async batchUpdate(items: { id: string; status: string; txHash?: string }[]) {
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        await this.prisma.revenueClaim.update({
          where: { id: item.id },
          data: {
            status: item.status,
            ...(item.txHash !== undefined && { txHash: item.txHash }),
          },
        });
        updated++;
      } catch (err) {
        failed++;
        errors.push(`${item.id}: ${err.message}`);
      }
    }

    return { updated, failed, errors };
  }

  async queryRevenueClaims(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return this.prisma.revenueClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        authorClaim: {
          select: {
            id: true,
            beneficiaryAddress: true,
            githubUsername: true,
            user: { select: { id: true, username: true, walletAddress: true, githubLogin: true } },
            skill: {
              select: {
                id: true, name: true,
                tokenLaunches: {
                  where: { status: 'ACTIVE', tokenAddress: { not: null } },
                  select: { id: true, name: true, symbol: true, tokenAddress: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
  }
}
