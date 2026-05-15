import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(user.id, dto.tokenLaunchId, dto.content);
  }

  @Get()
  async findByToken(
    @Query('tokenLaunchId') tokenLaunchId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commentsService.findByToken(
      tokenLaunchId,
      parseInt(page || '1', 10),
      Math.min(parseInt(limit || '50', 10), 100),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.commentsService.delete(id, user.id);
  }
}
