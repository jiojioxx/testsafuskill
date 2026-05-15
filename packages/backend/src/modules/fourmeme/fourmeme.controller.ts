import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FourmemeService } from './fourmeme.service';

@Controller('tokens/fourmeme')
@UseGuards(JwtAuthGuard)
export class FourmemeController {
  private readonly logger = new Logger(FourmemeController.name);

  constructor(private readonly fourmemeService: FourmemeService) {}

  @Post('nonce')
  async getNonce(@Body() body: { walletAddress: string }) {
    this.logger.log(`[four.meme] /nonce wallet=${body.walletAddress}`);
    return { nonce: await this.fourmemeService.getNonce(body.walletAddress) };
  }

  @Post('login')
  async login(
    @CurrentUser() user: any,
    @Body() body: { walletAddress: string; signature: string; nonce: string },
  ) {
    this.logger.log(`[four.meme] /login user=${user.id} wallet=${body.walletAddress}`);
    const accessToken = await this.fourmemeService.login(user.id, body.walletAddress, body.signature, body.nonce);
    return { success: true, accessToken };
  }

  @Get('check-token')
  async checkToken(@CurrentUser() user: any) {
    const valid = await this.fourmemeService.checkAccessToken(user.id);
    this.logger.log(`[four.meme] /check-token user=${user.id} valid=${valid}`);
    return { valid };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new UnauthorizedException('Image file is required');
    this.logger.log(`[four.meme] /upload user=${user.id} file=${file.originalname} size=${file.size}`);
    return { imageUrl: await this.fourmemeService.uploadImage(user.id, file) };
  }

  @Post('signature')
  async getSignature(
    @CurrentUser() user: any,
    @Body()
    body: {
      name: string;
      symbol: string;
      description?: string;
      imgUrl: string;
      website?: string;
      twitter?: string;
    },
  ) {
    const params = this.fourmemeService.buildCreateParams({
      name: body.name,
      symbol: body.symbol,
      description: body.description,
      imgUrl: body.imgUrl,
      website: body.website,
      twitter: body.twitter,
    });
    return this.fourmemeService.getCreateSignature(user.id, params);
  }
}
