import { Controller, Get, Post, Body, Param, Headers, UseGuards, UnauthorizedException } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { ClaimRevenueDto } from './dto/claim-revenue.dto';
import { BatchUpdateRevenueClaimsDto } from './dto/batch-update.dto';
import { QueryRevenueClaimsDto } from './dto/query-revenue-claims.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const INTERNAL_API_KEY = 'fced51f1d3a043f19910cddd2ccadf98';

@Controller('revenue')
export class RevenueController {
  constructor(private revenueService: RevenueService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyRevenue(@CurrentUser() user: any) {
    return this.revenueService.getMyRevenue(user.id);
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  async claimRevenue(@CurrentUser() user: any, @Body() dto: ClaimRevenueDto) {
    return this.revenueService.claimRevenue(user.id, dto.authorClaimId);
  }

  @Get('claims/:authorClaimId')
  @UseGuards(JwtAuthGuard)
  async getClaimHistory(@CurrentUser() user: any, @Param('authorClaimId') authorClaimId: string) {
    return this.revenueService.getClaimHistory(user.id, authorClaimId);
  }

  @Post('admin/batch-update')
  async batchUpdate(@Headers('x-api-key') apiKey: string, @Body() dto: BatchUpdateRevenueClaimsDto) {
    if (apiKey !== INTERNAL_API_KEY) throw new UnauthorizedException('Invalid API key');
    return this.revenueService.batchUpdate(dto.items);
  }

  @Post('admin/query')
  async queryRevenueClaims(@Headers('x-api-key') apiKey: string, @Body() dto: QueryRevenueClaimsDto) {
    if (apiKey !== INTERNAL_API_KEY) throw new UnauthorizedException('Invalid API key');
    return this.revenueService.queryRevenueClaims(dto.status);
  }
}
