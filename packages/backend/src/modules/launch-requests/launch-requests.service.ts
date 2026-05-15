import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class LaunchRequestsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user can launch a token for a skill directly,
   * or needs to request permission.
   * 
   * Logic:
   * - ZIP uploads (sourceRepo = null): Only uploader can launch directly
   * - GitHub URL uploads (sourceRepo != null): Only verified author (authorClaim) or approved requests can launch
   *   (uploader also needs approval since they're not the real author)
   */
  async checkPermission(userId: string, skillId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      include: {
        authorClaim: { select: { userId: true, status: true } },
        tokenLaunches: { where: { status: { in: ['ACTIVE', 'DEPLOYING'] } }, select: { id: true }, take: 1 },
      },
    });

    if (!skill) throw new NotFoundException('Skill not found');

    // Already has an active token
    if (skill.tokenLaunches.length > 0) {
      return { canLaunchDirectly: false, reason: 'already_tokenized' as const, pendingRequest: null };
    }

    // Case 1: ZIP uploads - Only uploader is the author
    if (!skill.sourceRepo) {
      if (skill.userId === userId) {
        return { canLaunchDirectly: true, reason: 'owner' as const, pendingRequest: null };
      }
      // Others need to request from uploader
    }

    // Case 2: GitHub URL uploads - Only verified author or approved requests
    if (skill.sourceRepo) {
      // Verified GitHub author (has authorClaim)
      if (skill.authorClaim?.userId === userId && skill.authorClaim.status === 'VERIFIED') {
        return { canLaunchDirectly: true, reason: 'claimed' as const, pendingRequest: null };
      }
      // Repo owner: user's githubLogin matches skill's authorName
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { githubLogin: true } });
      if (user?.githubLogin && skill.authorName &&
          user.githubLogin.toLowerCase() === skill.authorName.toLowerCase()) {
        return { canLaunchDirectly: true, reason: 'claimed' as const, pendingRequest: null };
      }
      // Note: uploader (skill.userId) also needs approval since they're not the real author
    }

    // Check for existing approved request
    const existingRequest = await this.prisma.tokenLaunchRequest.findUnique({
      where: { requesterId_skillId: { requesterId: userId, skillId } },
      select: { id: true, status: true, createdAt: true },
    });

    if (existingRequest?.status === 'APPROVED') {
      return { canLaunchDirectly: true, reason: 'approved' as const, pendingRequest: existingRequest };
    }

    return {
      canLaunchDirectly: false,
      reason: 'needs_request' as const,
      pendingRequest: existingRequest || null,
    };
  }

  /** Submit a launch request */
  async createRequest(requesterId: string, skillId: string, message?: string) {
    const check = await this.checkPermission(requesterId, skillId);

    if (check.canLaunchDirectly) {
      throw new BadRequestException('You can already launch directly for this skill');
    }
    if (check.reason === 'already_tokenized') {
      throw new BadRequestException('This skill already has an active token');
    }
    if (check.pendingRequest) {
      if (check.pendingRequest.status === 'REJECTED') {
        // Allow re-request: update existing rejected request back to PENDING
        return this.prisma.tokenLaunchRequest.update({
          where: { requesterId_skillId: { requesterId, skillId } },
          data: { status: 'PENDING', message, reviewedBy: null, reviewedAt: null, reviewNote: null },
          include: {
            skill: { select: { id: true, name: true } },
            requester: { select: { id: true, username: true, avatarUrl: true } },
          },
        });
      }
      throw new BadRequestException(`You already have a ${check.pendingRequest.status.toLowerCase()} request for this skill`);
    }

    return this.prisma.tokenLaunchRequest.create({
      data: { requesterId, skillId, message },
      include: {
        skill: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  /** Get requests submitted by the user */
  async getMyRequests(userId: string) {
    return this.prisma.tokenLaunchRequest.findMany({
      where: { requesterId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: { select: { id: true, name: true, authorName: true } },
      },
    });
  }

  /** Get pending requests for skills the user owns or has claimed */
  async getPendingForReview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { githubLogin: true } });
    console.log('[getPendingForReview] userId:', userId, 'githubLogin:', user?.githubLogin);

    const ownedSkillIds = await this.prisma.skill.findMany({
      where: { userId, sourceRepo: null },
      select: { id: true },
    });
    console.log('[getPendingForReview] ownedSkillIds:', ownedSkillIds.map(s => s.id));

    const claimedSkillIds = await this.prisma.authorClaim.findMany({
      where: { userId, status: 'VERIFIED' },
      select: { skillId: true },
    });
    console.log('[getPendingForReview] claimedSkillIds:', claimedSkillIds.map(c => c.skillId));

    const githubMatchSkillIds = user?.githubLogin
      ? await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM gh_skills
          WHERE source_repo IS NOT NULL
          AND LOWER(author_name) = LOWER(${user.githubLogin})
        `
      : [];
    console.log('[getPendingForReview] githubMatchSkillIds:', (githubMatchSkillIds as Array<{ id: string }>).map(s => s.id));

    const allSkillIds = [...new Set([
      ...ownedSkillIds.map((s) => s.id),
      ...claimedSkillIds.map((c) => c.skillId),
      ...(githubMatchSkillIds as Array<{ id: string }>).map((s) => s.id),
    ])];
    console.log('[getPendingForReview] allSkillIds:', allSkillIds);

    if (allSkillIds.length === 0) return [];

    const requests = await this.prisma.tokenLaunchRequest.findMany({
      where: {
        skillId: { in: allSkillIds },
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        skill: { select: { id: true, name: true } },
        requester: { select: { id: true, username: true, avatarUrl: true, walletAddress: true } },
      },
    });
    console.log('[getPendingForReview] found requests:', requests.length);

    return requests;
  }

  /** Approve a request (only skill owner / claimed author) */
  async approve(userId: string, requestId: string) {
    const request = await this.getRequestAndValidateReviewer(userId, requestId);

    return this.prisma.tokenLaunchRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date() },
    });
  }

  /** Reject a request */
  async reject(userId: string, requestId: string, reviewNote?: string) {
    const request = await this.getRequestAndValidateReviewer(userId, requestId);

    return this.prisma.tokenLaunchRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', reviewedBy: userId, reviewedAt: new Date(), reviewNote },
    });
  }

  /** Count pending requests for skills the user owns or has claimed */
  async getPendingCount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { githubLogin: true } });

    const ownedSkillIds = await this.prisma.skill.findMany({
      where: { userId, sourceRepo: null },
      select: { id: true },
    });
    const claimedSkillIds = await this.prisma.authorClaim.findMany({
      where: { userId, status: 'VERIFIED' },
      select: { skillId: true },
    });
    const githubMatchSkillIds = user?.githubLogin
      ? await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM gh_skills
          WHERE source_repo IS NOT NULL
          AND LOWER(author_name) = LOWER(${user.githubLogin})
        `
      : [];

    const allSkillIds = [...new Set([
      ...ownedSkillIds.map((s) => s.id),
      ...claimedSkillIds.map((c) => c.skillId),
      ...(githubMatchSkillIds as Array<{ id: string }>).map((s) => s.id),
    ])];

    if (allSkillIds.length === 0) return { count: 0 };

    const count = await this.prisma.tokenLaunchRequest.count({
      where: {
        skillId: { in: allSkillIds },
        status: 'PENDING',
      },
    });

    return { count };
  }

  /** Public detail for the shareable request page — no auth required */
  async getPublicDetail(requestId: string) {
    const request = await this.prisma.tokenLaunchRequest.findUnique({
      where: { id: requestId },
      include: {
        skill: {
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            authorName: true,
            sourceRepo: true,
            repoUrl: true,
            authorAvatar: true,
            stars: true,
            language: true,
            category: true,
          },
        },
        requester: {
          select: { id: true, username: true, avatarUrl: true, walletAddress: true },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found');

    return {
      id: request.id,
      status: request.status,
      message: request.message,
      createdAt: request.createdAt,
      reviewNote: request.reviewNote,
      skill: request.skill,
      requester: {
        username: request.requester.username,
        avatarUrl: request.requester.avatarUrl,
        walletAddress: request.requester.walletAddress,
      },
    };
  }

  /**
   * Verify-approve: the logged-in user's GitHub username must match the skill's authorName.
   * If match, auto-create AuthorClaim (if not exists) and approve the request.
   */
  async verifyApproveByGitHub(userId: string, requestId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, githubId: true, githubLogin: true },
    });
    if (!user || !user.githubId) {
      throw new ForbiddenException('You must be logged in with GitHub to verify');
    }
    if (!user.githubLogin) {
      throw new ForbiddenException('Your account does not have a GitHub login associated. Please re-login with GitHub.');
    }

    const request = await this.prisma.tokenLaunchRequest.findUnique({
      where: { id: requestId },
      include: {
        skill: {
          include: { authorClaim: { select: { userId: true, status: true } } },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request already reviewed');
    if (request.requesterId === userId) throw new ForbiddenException('Cannot approve your own request');

    // Verify GitHub login matches skill author
    const skillAuthor = request.skill.authorName?.toLowerCase();
    const userGitHub = user.githubLogin.toLowerCase();

    if (!skillAuthor || skillAuthor !== userGitHub) {
      throw new ForbiddenException(
        `Your GitHub account (${user.githubLogin}) does not match the skill author (${request.skill.authorName})`,
      );
    }

    // Auto-create AuthorClaim if not exists
    if (!request.skill.authorClaim) {
      await this.prisma.authorClaim.create({
        data: {
          userId,
          skillId: request.skill.id,
          status: 'VERIFIED',
          githubUsername: user.githubLogin,
          sourceRepo: request.skill.sourceRepo || '',
          verifiedAt: new Date(),
        },
      });
    }

    // Approve the request
    return this.prisma.tokenLaunchRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', reviewedBy: userId, reviewedAt: new Date() },
    });
  }

  private async getRequestAndValidateReviewer(userId: string, requestId: string) {
    const request = await this.prisma.tokenLaunchRequest.findUnique({
      where: { id: requestId },
      include: {
        skill: { include: { authorClaim: { select: { userId: true, status: true } } } },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== 'PENDING') throw new BadRequestException('Request already reviewed');
    if (request.requesterId === userId) throw new ForbiddenException('Cannot review your own request');

    // Check reviewer is skill owner or claimed author (exclude system user)
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const isOwner = request.skill.userId === userId && request.skill.userId !== SYSTEM_USER_ID && !request.skill.sourceRepo;
    const isClaimed = request.skill.authorClaim?.userId === userId && request.skill.authorClaim.status === 'VERIFIED';

    // Check if user's GitHub login matches skill's authorName (case-insensitive)
    let isGithubMatch = false;
    if (request.skill.sourceRepo && request.skill.authorName) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { githubLogin: true } });
      if (user?.githubLogin) {
        isGithubMatch = user.githubLogin.toLowerCase() === request.skill.authorName.toLowerCase();
      }
    }

    if (!isOwner && !isClaimed && !isGithubMatch) {
      throw new ForbiddenException('You are not the owner or verified author of this skill');
    }

    return request;
  }
}
