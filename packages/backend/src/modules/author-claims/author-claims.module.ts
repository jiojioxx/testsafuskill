import { Module } from '@nestjs/common';
import { AuthorClaimsController } from './author-claims.controller';
import { AuthorClaimsService } from './author-claims.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthorClaimsController],
  providers: [AuthorClaimsService],
  exports: [AuthorClaimsService],
})
export class AuthorClaimsModule {}
