import { Module } from '@nestjs/common';
import { AuthorDisputesController } from './author-disputes.controller';
import { AuthorDisputesService } from './author-disputes.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthorDisputesController],
  providers: [AuthorDisputesService],
  exports: [AuthorDisputesService],
})
export class AuthorDisputesModule {}
