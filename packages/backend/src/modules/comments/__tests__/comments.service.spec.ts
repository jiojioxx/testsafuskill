import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from '../comments.service';
import { PrismaService } from '../../common/prisma.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      comment: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      tokenLaunch: { findUnique: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('should create a comment', async () => {
      prisma.tokenLaunch.findUnique.mockResolvedValue({ id: 'token-1' });
      prisma.comment.create.mockResolvedValue({ id: 'c1', content: 'hello', userId: 'u1' });

      const result = await service.create('u1', 'token-1', 'hello');
      expect(result.content).toBe('hello');
    });

    it('should throw if token not found', async () => {
      prisma.tokenLaunch.findUnique.mockResolvedValue(null);
      await expect(service.create('u1', 'bad', 'hello')).rejects.toThrow(NotFoundException);
    });

    it('should enforce rate limit', async () => {
      prisma.tokenLaunch.findUnique.mockResolvedValue({ id: 'token-1' });
      prisma.comment.create.mockResolvedValue({ id: 'c1', content: 'msg' });

      // 5 comments should work
      for (let i = 0; i < 5; i++) {
        await service.create('rate-user', 'token-1', `msg ${i}`);
      }
      // 6th should fail
      await expect(service.create('rate-user', 'token-1', 'one more')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete own comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.comment.delete.mockResolvedValue({ id: 'c1' });

      await service.delete('c1', 'u1');
      expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('should reject deleting others comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      await expect(service.delete('c1', 'u2')).rejects.toThrow(ForbiddenException);
    });
  });
});
