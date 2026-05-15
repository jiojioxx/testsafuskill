import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LaunchRequestsService } from '../launch-requests.service';
import { PrismaService } from '../../common/prisma.service';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

describe('LaunchRequestsService', () => {
  let service: LaunchRequestsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      skill: { findUnique: jest.fn(), findMany: jest.fn() },
      tokenLaunchRequest: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      authorClaim: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        LaunchRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LaunchRequestsService);
  });

  describe('checkPermission', () => {
    it('should return canLaunchDirectly=true when user owns a ZIP-uploaded skill (sourceRepo=null)', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null, authorClaim: null, tokenLaunches: [],
      });

      const result = await service.checkPermission('user-1', 'skill-1');
      expect(result.canLaunchDirectly).toBe(true);
      expect(result.reason).toBe('owner');
    });

    it('should return needs_request when uploader tries to launch GitHub-uploaded skill', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: 'owner/repo', authorClaim: null, tokenLaunches: [],
      });
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue(null);

      const result = await service.checkPermission('user-1', 'skill-1');
      expect(result.canLaunchDirectly).toBe(false);
      expect(result.reason).toBe('needs_request');
    });

    it('should return canLaunchDirectly=true when user has verified claim on GitHub skill', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: SYSTEM_USER_ID, sourceRepo: 'owner/repo',
        authorClaim: { userId: 'user-2', status: 'VERIFIED' },
        tokenLaunches: [],
      });

      const result = await service.checkPermission('user-2', 'skill-1');
      expect(result.canLaunchDirectly).toBe(true);
      expect(result.reason).toBe('claimed');
    });

    it('should return already_tokenized when skill has active token', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null,
        authorClaim: null,
        tokenLaunches: [{ id: 'token-1' }],
      });

      const result = await service.checkPermission('user-3', 'skill-1');
      expect(result.canLaunchDirectly).toBe(false);
      expect(result.reason).toBe('already_tokenized');
    });

    it('should return needs_request when user has no permission on ZIP skill', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null, authorClaim: null, tokenLaunches: [],
      });
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue(null);

      const result = await service.checkPermission('user-3', 'skill-1');
      expect(result.canLaunchDirectly).toBe(false);
      expect(result.reason).toBe('needs_request');
    });

    it('should return needs_request when user has no permission on GitHub skill', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: 'owner/repo', authorClaim: null, tokenLaunches: [],
      });
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue(null);

      const result = await service.checkPermission('user-3', 'skill-1');
      expect(result.canLaunchDirectly).toBe(false);
      expect(result.reason).toBe('needs_request');
    });

    it('should return approved when user has approved request', async () => {
      prisma.skill.findUnique.mockResolvedValue({
        id: 'skill-1', userId: 'user-1', sourceRepo: null, authorClaim: null, tokenLaunches: [],
      });
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

      const result = await service.checkPermission('user-3', 'skill-1');
      expect(result.canLaunchDirectly).toBe(true);
      expect(result.reason).toBe('approved');
    });

    it('should throw NotFoundException for non-existent skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);
      await expect(service.checkPermission('user-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRequest', () => {
    it('should throw if user can already launch directly', async () => {
      jest.spyOn(service, 'checkPermission').mockResolvedValue({
        canLaunchDirectly: true, reason: 'owner' as const, pendingRequest: null,
      });

      await expect(service.createRequest('user-1', 'skill-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw if skill already tokenized', async () => {
      jest.spyOn(service, 'checkPermission').mockResolvedValue({
        canLaunchDirectly: false, reason: 'already_tokenized' as const, pendingRequest: null,
      });

      await expect(service.createRequest('user-1', 'skill-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow re-request after rejection', async () => {
      jest.spyOn(service, 'checkPermission').mockResolvedValue({
        canLaunchDirectly: false, reason: 'needs_request' as const,
        pendingRequest: { id: 'req-1', status: 'REJECTED', createdAt: new Date() },
      });
      prisma.tokenLaunchRequest.update.mockResolvedValue({ id: 'req-1', status: 'PENDING' });

      const result = await service.createRequest('user-1', 'skill-1', 'please reconsider');
      expect(prisma.tokenLaunchRequest.update).toHaveBeenCalled();
      expect(result.status).toBe('PENDING');
    });
  });

  describe('approve/reject', () => {
    it('should prevent self-approval', async () => {
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue({
        id: 'req-1', requesterId: 'user-1', status: 'PENDING',
        skill: { userId: 'user-1', authorClaim: null },
      });

      await expect(service.approve('user-1', 'req-1')).rejects.toThrow(ForbiddenException);
    });

    it('should prevent system user from approving', async () => {
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue({
        id: 'req-1', requesterId: 'user-2', status: 'PENDING',
        skill: { userId: SYSTEM_USER_ID, authorClaim: null },
      });

      await expect(service.approve(SYSTEM_USER_ID, 'req-1')).rejects.toThrow(ForbiddenException);
    });

    it('should allow skill owner to approve', async () => {
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue({
        id: 'req-1', requesterId: 'user-2', status: 'PENDING',
        skill: { userId: 'user-1', authorClaim: null },
      });
      prisma.tokenLaunchRequest.update.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

      const result = await service.approve('user-1', 'req-1');
      expect(result.status).toBe('APPROVED');
    });

    it('should allow claimed author to approve', async () => {
      prisma.tokenLaunchRequest.findUnique.mockResolvedValue({
        id: 'req-1', requesterId: 'user-3', status: 'PENDING',
        skill: { userId: SYSTEM_USER_ID, authorClaim: { userId: 'user-2', status: 'VERIFIED' } },
      });
      prisma.tokenLaunchRequest.update.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

      const result = await service.approve('user-2', 'req-1');
      expect(result.status).toBe('APPROVED');
    });
  });
});
