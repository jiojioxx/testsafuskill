import { Module } from '@nestjs/common';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { PrismaModule } from '../common/prisma.module';
import { ChainIndexerModule } from '../chain-indexer/chain-indexer.module';

@Module({
  imports: [PrismaModule, ChainIndexerModule],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
