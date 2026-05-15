import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, ParseIntPipe, DefaultValuePipe,
  Headers, UnauthorizedException, Req, HttpException, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkillsService } from './skills.service';
import { CreateSkillDto, CreateSkillFromGithubDto } from './dto/create-skill.dto';
import { S3Service } from '../common/s3.service';
import { ConfigService } from '@nestjs/config';
import { AdminService } from '../admin/admin.service';

@Controller('skills')
export class SkillsController {
  private readonly METADATA_API_KEY = 'fced51f1d3a043f19910cddd2ccadf98';
  private readonly rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private skillsService: SkillsService,
    private s3Service: S3Service,
    private config: ConfigService,
    private adminService: AdminService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800') },
    }),
  )
  upload(
    @CurrentUser() user: any,
    @Body() dto: CreateSkillDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.skillsService.create(user.id, dto, file);
  }

  @Post('from-github')
  @UseGuards(JwtAuthGuard)
  uploadFromGithub(
    @CurrentUser() user: any,
    @Body() dto: CreateSkillFromGithubDto,
  ) {
    return this.skillsService.createFromGithub(user.id, dto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: 'stars' | 'score' | 'recent' | 'downloads',
    @Query('search') search?: string,
  ) {
    return this.skillsService.findAll(page, Math.min(limit, 100), category, sortBy, search);
  }

  @Get('stats')
  async getStats() {
    const total = await this.skillsService.count();
    return { total };
  }

  @Get('lookup')
  lookup(@Query('name') name: string) {
    return this.skillsService.lookup(name || '');
  }

  @Post('resolve')
  resolve(@Body('slug') slug: string) {
    return this.skillsService.resolve(slug || '');
  }

  @Get('search')
  searchSkills(
    @Query('q') q: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.skillsService.search(q || '', page, Math.min(limit, 50));
  }

  @Get('featured')
  async getFeaturedIds() {
    return this.adminService.getFeaturedIds();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMySkills(@CurrentUser() user: any) {
    return this.skillsService.findByUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.skillsService.findOne(id);
  }

  @Get(':id/download')
  @UseGuards(JwtOptionalGuard)
  async download(@Param('id') id: string, @Res() res: Response, @Req() req: Request) {
    const user = (req as any).user;
    const authHeader = req.headers['authorization'];
    console.log('[download] authorization header =', authHeader ? authHeader.substring(0, 30) + '...' : 'NONE');
    console.log('[download] req.user =', JSON.stringify(user));
    const skill = await this.skillsService.download(id, user?.id, user?.walletAddress);
    
    try {
      // Get file from S3 directly and stream it
      const s3Object = await this.s3Service.getFile(skill.filePath);
      
      // Set appropriate headers based on actual file type
      const ext = skill.filePath ? extname(skill.filePath).toLowerCase() : '.zip';
      const isMarkdown = ext === '.md';
      const filename = `${skill.name || 'download'}${isMarkdown ? '.md' : '.zip'}`;
      res.setHeader('Content-Type', isMarkdown ? 'text/markdown' : 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Stream the file to response
      const { Readable } = require('stream');
      if (s3Object.Body instanceof Readable) {
        s3Object.Body.pipe(res);
      } else if (s3Object.Body) {
        // Handle other body types (Buffer, Uint8Array, etc.)
        res.send(s3Object.Body);
      } else {
        throw new Error('No file content received from S3');
      }
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.skillsService.remove(id, user.id);
  }

  @Post(':id/rescan')
  rescan(@Param('id') id: string, @Headers('x-api-key') apiKey: string) {
    // 验证 API key
    if (apiKey !== 'fced51f1d3a043f19910cddd2ccadf98') {
      throw new UnauthorizedException('Invalid API key');
    }
    return this.skillsService.rescan(id);
  }

  @Get('featured')
  async getFeaturedSkills() {
    try {
      return await this.adminService.getFeaturedIds();
    } catch (error) {
      console.error('Error fetching featured skills:', error);
      return [];
    }
  }

  @Get('list/metadata')
  async getSkillsWithMetadata(
    @Headers('x-api-key') apiKey: string,
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    if (apiKey !== this.METADATA_API_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = this.rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      this.rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    } else if (entry.count >= 60) {
      throw new HttpException('Rate limit exceeded: 60 requests per minute', HttpStatus.TOO_MANY_REQUESTS);
    } else {
      entry.count++;
    }

    return this.skillsService.findAllWithMetadata(page, Math.min(limit, 100));
  }
}
