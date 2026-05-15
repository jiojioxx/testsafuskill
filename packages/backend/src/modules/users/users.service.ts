import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface CreateUserInput {
  username: string;
  email?: string | null;
  githubId?: string;
  walletAddress?: string;
  avatarUrl?: string | null;
  githubAccessToken?: string;
  githubLogin?: string | null;
  walletRequired?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByGithubId(githubId: string) {
    return this.prisma.user.findUnique({ where: { githubId } });
  }

  findByWalletAddress(walletAddress: string) {
    return this.prisma.user.findUnique({ where: { walletAddress } });
  }

  create(data: CreateUserInput) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Partial<CreateUserInput>) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async generateUniqueUsername(base: string): Promise<string> {
    const sanitized = base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 25);
    const existing = await this.prisma.user.findUnique({ where: { username: sanitized } });
    if (!existing) return sanitized;

    let counter = 1;
    while (true) {
      const candidate = `${sanitized}_${counter}`;
      const found = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!found) return candidate;
      counter++;
    }
  }

  getProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        walletAddress: true,
        githubId: true,
        githubLogin: true,
        createdAt: true,
      },
    });
  }
}
