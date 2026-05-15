import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthorClaimsService } from '../author-claims.service';
import { PrismaService } from '../../common/prisma.service';

describe('AuthorClaimsService', () => {
  let service: AuthorClaimsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      skill: { findUnique: jest.fn() },
      authorClaim: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthorClaimsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuthorClaimsService);
  });

  describe('createClaim', () => {
    it('should throw if user has no GitHub auth', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', githubId: null, githubAccessToken: null });
      await expect(service.createClaim('u1', 'skill-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if skill has no sourceRepo', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', githubId: '123', githubAccessToken: 'token' });
      prisma.skill.findUnique.mockResolvedValue({ id: 'skill-1', sourceRepo: null });
      await expect(service.createClaim('u1', 'skill-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if skill already claimed', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', githubId: '123', githubAccessToken: 'token' });
      prisma.skill.findUnique.mockResolvedValue({ id: 'skill-1', sourceRepo: 'owner/repo' });
      prisma.authorClaim.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.createClaim('u1', 'skill-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if skill not found', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', githubId: '123', githubAccessToken: 'token' });
      prisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.createClaim('u1', 'skill-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBeneficiary', () => {
    it('should update beneficiary for claim owner', async () => {
      prisma.authorClaim.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.authorClaim.update.mockResolvedValue({ id: 'c1', beneficiaryAddress: '0x1234' });

      const result = await service.updateBeneficiary('c1', 'u1', '0x1234567890AbCdEf1234567890AbCdEf12345678');
      expect(prisma.authorClaim.update).toHaveBeenCalled();
    });

    it('should reject non-owner', async () => {
      prisma.authorClaim.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      await expect(service.updateBeneficiary('c1', 'u2', '0x123')).rejects.toThrow(ForbiddenException);
    });
  });
});
