import { Module } from '@nestjs/common';
import { ChainIndexerService } from './chain-indexer.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ChainIndexerService],
  exports: [ChainIndexerService],
})
export class ChainIndexerModule {}
