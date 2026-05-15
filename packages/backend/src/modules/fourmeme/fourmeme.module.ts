import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { FourmemeController } from './fourmeme.controller';
import { FourmemeService } from './fourmeme.service';

@Module({
  imports: [PrismaModule],
  controllers: [FourmemeController],
  providers: [FourmemeService],
  exports: [FourmemeService],
})
export class FourmemeModule {}
