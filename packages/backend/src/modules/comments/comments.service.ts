import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CommentsService {
  // Rate limit: max 5 comments per minute per user
  private rateLimitMap = new Map<string, number[]>();

  constructor(private prisma: PrismaService) {}

  private checkRateLimit(userId: string) {
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < 60_000);
    if (recent.length >= 5) {
      throw new BadRequestException('Rate limit: max 5 comments per minute');
    }
    recent.push(now);
    this.rateLimitMap.set(userId, recent);
  }

  async create(userId: string, tokenLaunchId: string, content: string) {
    this.checkRateLimit(userId);

    const token = await this.prisma.tokenLaunch.findUnique({ where: { id: tokenLaunchId } });
    if (!token) throw new NotFoundException('Token not found');

    return this.prisma.comment.create({
      data: { userId, tokenLaunchId, content: content.trim() },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, walletAddress: true } },
      },
    });
  }

  async findByToken(tokenLaunchId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { tokenLaunchId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true, walletAddress: true } },
        },
      }),
      this.prisma.comment.count({ where: { tokenLaunchId } }),
    ]);
    return { comments, total, page, limit };
  }

  async delete(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Not your comment');
    return this.prisma.comment.delete({ where: { id } });
  }
}
