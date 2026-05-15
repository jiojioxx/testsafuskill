import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { LaunchRequestsService } from './launch-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('launch-requests')
export class LaunchRequestsController {
  constructor(private service: LaunchRequestsService) {}

  @Get('check/:skillId')
  @UseGuards(JwtAuthGuard)
  async check(@CurrentUser() user: any, @Param('skillId') skillId: string) {
    return this.service.checkPermission(user.id, skillId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: any,
    @Body() body: { skillId: string; message?: string },
  ) {
    return this.service.createRequest(user.id, body.skillId, body.message);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyRequests(@CurrentUser() user: any) {
    return this.service.getMyRequests(user.id);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async getPending(@CurrentUser() user: any) {
    return this.service.getPendingForReview(user.id);
  }

  @Get('pending/count')
  @UseGuards(JwtAuthGuard)
  async getPendingCount(@CurrentUser() user: any) {
    return this.service.getPendingCount(user.id);
  }

  /** Public endpoint — no auth required. Returns request details for the public review page. */
  @Get(':id/public')
  async getPublicDetail(@Param('id') id: string) {
    return this.service.getPublicDetail(id);
  }

  /** GitHub-verified approve — user logs in with GitHub, we verify they are the skill author */
  @Put(':id/verify-approve')
  @UseGuards(JwtAuthGuard)
  async verifyApprove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.verifyApproveByGitHub(user.id, id);
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard)
  async approve(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.approve(user.id, id);
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard)
  async reject(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.service.reject(user.id, id, body.reviewNote);
  }
}
