import { Module } from '@nestjs/common';
import { RankingController } from './ranking.controller';
import { ScoringService } from './scoring.service';
import { QualityAnalyzerService } from './quality-analyzer.service';
import { PlatformDetectorService } from './platform-detector.service';

@Module({
  controllers: [RankingController],
  providers: [ScoringService, QualityAnalyzerService, PlatformDetectorService],
  exports: [ScoringService, QualityAnalyzerService, PlatformDetectorService],
})
export class RankingModule {}
