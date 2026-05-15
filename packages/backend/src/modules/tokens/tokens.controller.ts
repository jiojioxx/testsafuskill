import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ChainIndexerService } from '../chain-indexer/chain-indexer.service';

@Controller('tokens')
export class TokensController {
  constructor(
    private tokensService: TokensService,
    private chainIndexer: ChainIndexerService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() dto: CreateTokenDto) {
    return this.tokensService.create(user.id, dto);
  }

  @Get()
  async findAll(@Query('limit') limit?: string, @Query('page') page?: string, @Query('sortBy') sortBy?: string) {
    const take = Math.min(parseInt(limit || '20', 10), 50);
    const pageNum = Math.max(parseInt(page || '1', 10), 1);
    return this.tokensService.findAll(take, pageNum, sortBy || 'newest');
  }

  @Get('feed')
  async getFeed() {
    return this.tokensService.getFeed();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: any) {
    return this.tokensService.findByUser(user.id);
  }

  @Get(':id')
  @UseGuards(JwtOptionalGuard)
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tokensService.findOne(id, user?.id);
  }

  @Get(':id/trades')
  async getTrades(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    // Resolve the tokenAddress from our DB
    const launch = await this.tokensService.findOne(id);
    if (!launch.tokenAddress) return [];
    const take = Math.min(parseInt(limit || '500', 10), 2000);
    return this.chainIndexer.getTradesForToken(launch.tokenAddress, take);
  }

  @Put(':id/deploying')
  @UseGuards(JwtAuthGuard)
  async markDeploying(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { txHash: string },
  ) {
    return this.tokensService.markDeploying(id, user.id, body.txHash);
  }

  @Put(':id/deployed')
  @UseGuards(JwtAuthGuard)
  async markDeployed(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { tokenAddress: string; txHash: string; imageUrl?: string; blockNumber?: string },
  ) {
    const blockNum = body.blockNumber ? BigInt(body.blockNumber) : undefined;
    return this.tokensService.markDeployed(id, user.id, body.tokenAddress, body.txHash, body.imageUrl, blockNum);
  }

  @Put(':id/failed')
  @UseGuards(JwtAuthGuard)
  async markFailed(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tokensService.markFailed(id, user.id);
  }
}
