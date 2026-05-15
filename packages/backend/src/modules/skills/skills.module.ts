import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { ScanModule } from '../scan/scan.module';
import { AdminModule } from '../admin/admin.module';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ScanModule,
    forwardRef(() => AdminModule),
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SkillsController],
  providers: [SkillsService, JwtStrategy],
  exports: [SkillsService],
})
export class SkillsModule {}
