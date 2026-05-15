import { Module } from '@nestjs/common';
import { LaunchRequestsController } from './launch-requests.controller';
import { LaunchRequestsService } from './launch-requests.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LaunchRequestsController],
  providers: [LaunchRequestsService],
  exports: [LaunchRequestsService],
})
export class LaunchRequestsModule {}
