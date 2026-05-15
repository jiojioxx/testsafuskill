import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SkillsModule } from './modules/skills/skills.module';
import { ScanModule } from './modules/scan/scan.module';
import { PrismaModule } from './modules/common/prisma.module';
import { S3Module } from './modules/common/s3.module';
import { GithubSyncModule } from './modules/github-sync/github-sync.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { AuthorClaimsModule } from './modules/author-claims/author-claims.module';
import { CommentsModule } from './modules/comments/comments.module';
import { AdminModule } from './modules/admin/admin.module';
import { LaunchRequestsModule } from './modules/launch-requests/launch-requests.module';
import { ChainIndexerModule } from './modules/chain-indexer/chain-indexer.module';
import { RevenueModule } from './modules/revenue/revenue.module';
import { AuthorDisputesModule } from './modules/author-disputes/author-disputes.module';
import { FourmemeModule } from './modules/fourmeme/fourmeme.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    S3Module,
    AuthModule,
    UsersModule,
    SkillsModule,
    ScanModule,
    GithubSyncModule,
    RankingModule,
    TokensModule,
    AuthorClaimsModule,
    CommentsModule,
    AdminModule,
    LaunchRequestsModule,
    ChainIndexerModule,
    RevenueModule,
    AuthorDisputesModule,
    FourmemeModule,
  ],
})
export class AppModule {}
