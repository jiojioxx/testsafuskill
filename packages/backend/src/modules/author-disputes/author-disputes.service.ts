import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@Injectable()
export class AuthorDisputesService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  async create(userId: string, dto: CreateDisputeDto, files?: Express.Multer.File[]) {
    const existing = await this.prisma.authorDispute.findFirst({
      where: { userId, skillName: dto.skillName, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('You already have a pending dispute for this skill');

    let proofUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files.slice(0, 3)) {
        const key = this.s3.generateKey(userId, file.originalname, 'disputes');
        const url = await this.s3.uploadFile(file.buffer, key, file.mimetype);
        proofUrls.push(url);
      }
    }

    if (dto.resubmitFromId) {
      return this.prisma.$transaction(async (tx) => {
        const old = await tx.authorDispute.findFirst({
          where: { id: dto.resubmitFromId, userId, status: 'REJECTED' },
        });
        if (old) {
          await tx.authorDispute.delete({ where: { id: old.id } });
        }
        return tx.authorDispute.create({
          data: {
            userId,
            skillName: dto.skillName,
            tokenAddress: dto.tokenAddress || null,
            reason: dto.reason,
            proofUrls: proofUrls.length > 0 ? JSON.stringify(proofUrls) : null,
          },
        });
      });
    }

    return this.prisma.authorDispute.create({
      data: {
        userId,
        skillName: dto.skillName,
        tokenAddress: dto.tokenAddress || null,
        reason: dto.reason,
        proofUrls: proofUrls.length > 0 ? JSON.stringify(proofUrls) : null,
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.authorDispute.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserAndToken(userId: string, tokenAddress: string) {
    return this.prisma.authorDispute.findFirst({
      where: { userId, tokenAddress: tokenAddress.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
  }
}
