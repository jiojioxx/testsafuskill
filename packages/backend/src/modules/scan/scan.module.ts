import { Module } from '@nestjs/common';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';
import { AgentGuardAdapter } from './agentguard.adapter';

@Module({
  controllers: [ScanController],
  providers: [ScanService, AgentGuardAdapter],
  exports: [ScanService],
})
export class ScanModule {}
