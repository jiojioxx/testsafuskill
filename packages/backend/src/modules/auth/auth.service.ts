import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../common/email.service';
import { PrismaService } from '../common/prisma.service';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { SiweMessage } from 'siwe';

@Injectable()
export class AuthService {
  private nonceCache = new Map<string, { nonce: string; expiresAt: number }>();
  private codeCache = new Map<string, { code: string; expiresAt: number }>();
  private emailRateLimit = new Map<string, number>();
  private ipRateLimit = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  async validateGitHubUser(profile: any, accessToken?: string) {
    console.log('[GitHub Auth] Starting validation for user:', profile.id);
    const githubId = String(profile.id);
    let user = await this.usersService.findByGithubId(githubId);

    if (!user) {
      console.log('[GitHub Auth] User not found by GitHub ID, checking email...');
      const email = profile.emails?.[0]?.value || null;
      console.log('[GitHub Auth] Email from profile:', email ? 'present' : 'null');
      
      if (email) {
        user = await this.usersService.findByEmail(email);
        if (user) {
          console.log('[GitHub Auth] Found existing user by email, linking GitHub account');
          user = await this.usersService.update(user.id, { 
            githubId, 
            githubLogin: profile.username || null,
            ...(accessToken && { githubAccessToken: accessToken }) 
          });
        }
      }

      if (!user) {
        console.log('[GitHub Auth] Creating new user...');
        const baseUsername = profile.username || `gh_${githubId}`;
        const username = await this.usersService.generateUniqueUsername(baseUsername);
        user = await this.usersService.create({
          username,
          email,
          githubId,
          githubLogin: profile.username || null,
          avatarUrl: profile.photos?.[0]?.value || null,
          walletRequired: true,
          ...(accessToken && { githubAccessToken: accessToken }),
        });
        console.log('[GitHub Auth] New user created with ID:', user.id);
      }
    } else {
      console.log('[GitHub Auth] Found existing user by GitHub ID:', user.id);
      if (accessToken) {
        // Update access token and githubLogin on every login
        await this.usersService.update(user.id, { 
          githubAccessToken: accessToken, 
          githubLogin: profile.username || undefined 
        });
      }
    }

    return user;
  }

  getNonce(address: string): string {
    const nonce = Math.random().toString(36).substring(2, 15);
    this.nonceCache.set(address.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return nonce;
  }

  async walletLogin(dto: WalletLoginDto) {
    try {
      const address = dto.address.toLowerCase();
      const cached = this.nonceCache.get(address);

      if (!cached || Date.now() > cached.expiresAt) {
        throw new BadRequestException('Nonce expired or not found');
      }

      let siweMessage: SiweMessage;
      try {
        console.log('[walletLogin] raw message:', JSON.stringify(dto.message));
        siweMessage = new SiweMessage(dto.message);
        
        // 支持的链ID列表
        const supportedChainIds = [1, 11155111, 8453, 42161, 137, 10, 56, 97]; // mainnet, sepolia, base, arbitrum, polygon, optimism, bsc, bsc testnet
        
        console.log('[walletLogin] SIWE message parsed:', {
          domain: siweMessage.domain,
          address: siweMessage.address,
          chainId: siweMessage.chainId,
          nonce: siweMessage.nonce,
          cachedNonce: cached.nonce,
          expirationTime: siweMessage.expirationTime,
          issuedAt: siweMessage.issuedAt,
        });

        const result = await siweMessage.verify({ 
          signature: dto.signature,
          domain: siweMessage.domain,
          nonce: cached.nonce,
          time: new Date().toISOString(),
        });
        
        console.log('[walletLogin] SIWE verify result:', { success: result.success, error: result.error });

        if (!result.success) throw new Error('Invalid signature');
        
        // 验证链ID是否支持
        if (!supportedChainIds.includes(siweMessage.chainId)) {
          throw new Error(`Unsupported chain ID: ${siweMessage.chainId}`);
        }
        
      } catch (error) {
        console.error('[walletLogin] SIWE verification error:', {
          message: (error as any)?.message,
          domain: siweMessage?.domain,
          chainId: siweMessage?.chainId,
          nonce: siweMessage?.nonce,
          cachedNonce: cached?.nonce,
        });
        throw new UnauthorizedException('Invalid wallet signature');
      }

      if (siweMessage.nonce !== cached.nonce) {
        throw new UnauthorizedException('Nonce mismatch');
      }

      this.nonceCache.delete(address);

      let user = await this.usersService.findByWalletAddress(address);
      if (!user) {
        const username = await this.usersService.generateUniqueUsername(`wallet_${address.slice(2, 8)}`);
        console.log('Creating new user with username:', username);
        user = await this.usersService.create({ username, walletAddress: address });
      }

      return this.signToken(user.id, user.username, false); // Wallet login doesn't need wallet binding
    } catch (error) {
      console.error('Wallet login error:', error);
      throw error;
    }
  }

  // 发送邮箱验证码
  async sendVerificationCode(dto: SendCodeDto, clientIp?: string) {
    const now = Date.now();

    const lastSent = this.emailRateLimit.get(dto.email);
    if (lastSent && now - lastSent < 60_000) {
      const wait = Math.ceil((60_000 - (now - lastSent)) / 1000);
      throw new HttpException(`Please wait ${wait}s before requesting again`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (clientIp) {
      const ipData = this.ipRateLimit.get(clientIp);
      if (ipData && now < ipData.resetAt && ipData.count >= 5) {
        throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    this.emailRateLimit.set(dto.email, now);
    if (clientIp) {
      const ipData = this.ipRateLimit.get(clientIp);
      if (!ipData || now >= ipData.resetAt) {
        this.ipRateLimit.set(clientIp, { count: 1, resetAt: now + 10 * 60_000 });
      } else {
        ipData.count++;
      }
    }

    // 生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟后过期

    // 存储验证码
    this.codeCache.set(dto.email, { code, expiresAt });

    // 清理过期的验证码
    this.cleanExpiredCodes();

    // 发送邮件
    const emailSent = await this.emailService.sendVerificationCode(dto.email, code);
    
    if (emailSent) {
      console.log(`Verification code for ${dto.email}: ${code}`);
      return { 
        message: 'Verification code sent successfully',
        // 开发环境下返回验证码，生产环境下应该移除
        ...(process.env.NODE_ENV === 'development' && { code })
      };
    } else {
      // 邮件发送失败，仍然返回成功但使用控制台方式（降级处理）
      console.log(`Email failed, verification code for ${dto.email}: ${code}`);
      return { 
        message: 'Verification code sent (fallback mode)',
        // 邮件失败时在开发环境显示验证码
        ...(process.env.NODE_ENV === 'development' && { code })
      };
    }
  }

  // 验证邮箱验证码并注册/登录
  async verifyCodeAndLogin(dto: VerifyCodeDto) {
    const cached = this.codeCache.get(dto.email);
    
    if (!cached) {
      throw new BadRequestException('Verification code not found or expired');
    }

    if (Date.now() > cached.expiresAt) {
      this.codeCache.delete(dto.email);
      throw new BadRequestException('Verification code has expired');
    }

    if (cached.code !== dto.code) {
      throw new BadRequestException('Invalid verification code');
    }

    // 验证码正确，删除缓存的验证码
    this.codeCache.delete(dto.email);

    // 查找或创建用户
    let user = await this.usersService.findByEmail(dto.email);
    
    if (!user) {
      // 用户不存在，创建新用户
      const username = await this.usersService.generateUniqueUsername(dto.username);
      user = await this.usersService.create({
        username,
        email: dto.email,
        walletRequired: true,
      });
    }

    return this.signToken(user.id, user.username, user.walletRequired && !user.walletAddress);
  }

  async bindGithub(userId: string, profile: any, accessToken?: string) {
    const githubId = String(profile.id);
    const githubLogin = profile.username || profile.login || null;

    const existingUser = await this.usersService.findByGithubId(githubId);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('This GitHub account is already registered to another user');
    }

    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new UnauthorizedException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        githubId,
        githubLogin,
        ...(accessToken && { githubAccessToken: accessToken }),
        ...(!currentUser.avatarUrl && (profile.photos?.[0]?.value || profile.avatar_url) && { avatarUrl: profile.photos?.[0]?.value || profile.avatar_url }),
      },
    });

    return { success: true, githubLogin };
  }

  async checkWalletAddress(address: string) {
    const existing = await this.usersService.findByWalletAddress(address.toLowerCase());
    return { exists: !!existing };
  }

  async bindWallet(userId: string, address: string) {
    const normalizedAddress = address.toLowerCase();

    const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new UnauthorizedException('User not found');

    const existingUser = await this.usersService.findByWalletAddress(normalizedAddress);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException('This wallet address is already registered to another account');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalizedAddress },
    });

    return { success: true, user: updatedUser };
  }

  private cleanExpiredCodes() {
    const now = Date.now();
    for (const [email, data] of this.codeCache.entries()) {
      if (now > data.expiresAt) {
        this.codeCache.delete(email);
      }
    }
  }

  private signToken(userId: string, username: string, requiresWallet = false) {
    const token = this.jwtService.sign({ sub: userId, username });
    return { access_token: token, token_type: 'Bearer', requiresWallet };
  }

  private async migrateUserData(oldUserId: string, targetUserId: string, walletAddress: string) {
    console.log(`[migrateUserData] START old=${oldUserId} target=${targetUserId} wallet=${walletAddress}`);
    return await this.prisma.$transaction(async (tx) => {
      console.log(`[migrateUserData] TX started`);

      // 1. Migrate skills (update userId, handle conflicts)
      const skillsToMigrate = await tx.skill.findMany({ where: { userId: oldUserId } });
      console.log(`[migrateUserData] Skills to migrate: ${skillsToMigrate.length}`);
      let migratedSkills = 0;
      
      for (const skill of skillsToMigrate) {
        try {
          if (skill.sourceRepo && skill.sourcePath) {
            const existingSkill = await tx.skill.findUnique({
              where: { 
                sourceRepo_sourcePath: { 
                  sourceRepo: skill.sourceRepo, 
                  sourcePath: skill.sourcePath 
                }
              }
            });
            
            if (existingSkill && existingSkill.userId === targetUserId) {
              console.log(`[migrateUserData] Skill ${skill.id} conflict, skipping`);
              continue;
            }
          }

          console.log(`[migrateUserData] Migrating skill ${skill.id}`);
          await tx.skill.update({
            where: { id: skill.id },
            data: { userId: targetUserId }
          });
          migratedSkills++;
          console.log(`[migrateUserData] Skill ${skill.id} migrated`);
        } catch (error) {
          console.error(`[migrateUserData] Failed to migrate skill ${skill.id}:`, error);
        }
      }

      console.log(`[migrateUserData] Skills done: ${migratedSkills}`);

      // 2. Migrate token launches
      console.log(`[migrateUserData] Migrating tokenLaunches...`);
      const tokenLaunches = await tx.tokenLaunch.updateMany({
        where: { userId: oldUserId },
        data: { userId: targetUserId }
      });
      console.log(`[migrateUserData] TokenLaunches migrated: ${tokenLaunches.count}`);

      // 3. Delete old wallet-only user first (to release wallet_address unique constraint)
      console.log(`[migrateUserData] Deleting old user ${oldUserId}...`);
      await tx.user.delete({ where: { id: oldUserId } });
      console.log(`[migrateUserData] Old user deleted`);

      // 4. Bind wallet address to target user
      console.log(`[migrateUserData] Binding wallet to target user...`);
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { walletAddress: walletAddress }
      });
      console.log(`[migrateUserData] Wallet bound successfully`);

      return {
        success: true,
        message: 'Wallet bound successfully with data migration',
        migrationStats: {
          skills: migratedSkills,
          tokenLaunches: tokenLaunches.count,
        },
        user: updatedUser
      };
    });
  }
}
