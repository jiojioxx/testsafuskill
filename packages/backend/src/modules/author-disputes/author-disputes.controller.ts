import { Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthorDisputesService } from './author-disputes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@Controller('author-disputes')
export class AuthorDisputesController {
  constructor(private authorDisputesService: AuthorDisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('proofImages', 3, {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateDisputeDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.authorDisputesService.create(user.id, dto, files);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: any) {
    return this.authorDisputesService.findByUser(user.id);
  }

  @Get('check')
  @UseGuards(JwtAuthGuard)
  async checkByToken(@CurrentUser() user: any, @Query('tokenAddress') tokenAddress: string) {
    if (!tokenAddress) return null;
    return this.authorDisputesService.findByUserAndToken(user.id, tokenAddress);
  }
}
