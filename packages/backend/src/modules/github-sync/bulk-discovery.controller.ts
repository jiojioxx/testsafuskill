import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BulkDiscoveryService } from './bulk-discovery.service';

@Controller('bulk-discovery')
export class BulkDiscoveryController {
  constructor(private bulkDiscoveryService: BulkDiscoveryService) {}

  @Post('trigger')
  async triggerBulkDiscovery() {
    await this.bulkDiscoveryService.triggerBulkDiscovery();
    return { message: 'Bulk discovery triggered successfully' };
  }

  @Post('single-repo')
  async discoverSingleRepo(
    @Body() body: { owner: string; repo: string; basePath: string; category: string }
  ) {
    const { owner, repo, basePath, category } = body;
    const count = await this.bulkDiscoveryService.discoverSingleRepo(owner, repo, basePath, category);
    return { 
      message: `Single repo discovery completed for ${owner}/${repo}`,
      discoveredCount: count
    };
  }
}