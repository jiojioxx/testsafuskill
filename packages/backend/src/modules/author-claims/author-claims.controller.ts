import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AuthorClaimsService } from './author-claims.service';
import { CreateClaimDto } from './dto/create-claim.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('author-claims')
export class AuthorClaimsController {
  constructor(private authorClaimsService: AuthorClaimsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() dto: CreateClaimDto) {
    return this.authorClaimsService.createClaim(user.id, dto.skillId);
  }

  @Get('skill/:skillId')
  async findBySkill(@Param('skillId') skillId: string) {
    return this.authorClaimsService.findBySkillId(skillId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: any) {
    return this.authorClaimsService.findByUser(user.id);
  }

  @Put(':id/beneficiary')
  @UseGuards(JwtAuthGuard)
  async updateBeneficiary(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
  ) {
    return this.authorClaimsService.updateBeneficiary(id, user.id, dto.beneficiaryAddress);
  }
}
