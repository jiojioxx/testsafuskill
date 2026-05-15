import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('featured')
  @UseGuards(JwtAuthGuard)
  async getFeatured(@CurrentUser() user: any) {
    this.adminService.assertAdmin(user.id);
    return this.adminService.getFeatured();
  }

  @Post('featured')
  @UseGuards(JwtAuthGuard)
  async addFeatured(
    @CurrentUser() user: any,
    @Body() body: { sourceRepo: string; sourcePath: string; sortOrder?: number },
  ) {
    return this.adminService.addFeatured(user.id, body.sourceRepo, body.sourcePath, body.sortOrder ?? 0);
  }

  @Delete('featured/:id')
  @UseGuards(JwtAuthGuard)
  async removeFeatured(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.removeFeatured(user.id, id);
  }

  @Put('featured/:id')
  @UseGuards(JwtAuthGuard)
  async updateOrder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { sortOrder: number },
  ) {
    return this.adminService.updateFeaturedOrder(user.id, id, body.sortOrder);
  }

  @Post('cache/clear')
  @UseGuards(JwtAuthGuard)
  async clearCache(@CurrentUser() user: any) {
    this.adminService.assertAdmin(user.id);
    this.adminService.clearSkillsCache();
    return { success: true, message: 'Skills cache cleared' };
  }
}
