import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TokensService } from '../tokens.service';
import { PrismaService } from '../../common/prisma.service';

describe('TokensService', () => {
  let service: TokensService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      skill: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      authorClaim: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      tokenLaunch: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
      comment: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(TokensService);
  });

  describe('create', () => {
    const baseDto = {
      name: 'Test Token', symbol: 'TEST', skillId: 'skill-1',
      description: 'desc', chainId: 97,
    };

    it('should allow skill owner to create token', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null,
        authorClaim: null, tokenLaunches: [],
      });
      prisma.user.findUnique.mockResolvedValue({ walletAddress: null });
      prisma.authorClaim.create.mockResolvedValue({});
      prisma.tokenLaunch.create.mockResolvedValue({ id: 'token-1', ...baseDto });

      const result = await service.create('user-1', baseDto);
      expect(result.id).toBe('token-1');
    });

    it('should allow any user to create token (no permission check)', async () => {
      // 任何已登录用户都可以为任意 skill 创建代币（权限检查已移除）
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'other-user', sourceRepo: 'github.com/x/y',
        authorClaim: null, tokenLaunches: [],
      });
      prisma.user.findUnique.mockResolvedValue({ githubLogin: null, walletAddress: null });
      prisma.tokenLaunch.create.mockResolvedValue({ id: 'token-2', ...baseDto });

      const result = await service.create('user-3', baseDto);
      expect(result.id).toBe('token-2');
    });

    it('should reject if skill not found', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', baseDto)).rejects.toThrow(NotFoundException);
    });

    it('should reject if skill already has active token', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null,
        authorClaim: null, tokenLaunches: [{ id: 'existing' }],
      });

      await expect(service.create('user-1', baseDto)).rejects.toThrow(BadRequestException);
    });
  });
});
