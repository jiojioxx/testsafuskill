import { Module } from '@nestjs/common';
import { ScanModule } from '../scan/scan.module';
import { RankingModule } from '../ranking/ranking.module';
import { SkillsModule } from '../skills/skills.module';
import { GithubSyncService } from './github-sync.service';
import { SkillDiscoveryService } from './skill-discovery.service';
import { BulkDiscoveryService } from './bulk-discovery.service';
import { BulkDiscoveryController } from './bulk-discovery.controller';

@Module({
  imports: [ScanModule, RankingModule, SkillsModule],
  controllers: [BulkDiscoveryController],
  providers: [GithubSyncService, SkillDiscoveryService, BulkDiscoveryService],
})
export class GithubSyncModule {}
