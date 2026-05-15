import { Controller, Post, Body, Get, Req, Res, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // 发送邮箱验证码
  @Post('send-code')
  sendVerificationCode(@Body() dto: SendCodeDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    return this.authService.sendVerificationCode(dto, ip);
  }

  // 验证邮箱验证码并登录
  @Post('verify-code')
  verifyCodeAndLogin(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCodeAndLogin(dto);
  }

  @Get('github')
  githubLogin(@Res() res: any) {
    const clientId = this.config.get('GITHUB_CLIENT_ID');
    const callbackUrl = this.config.get('GITHUB_CALLBACK_URL');
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=user:email`;
    res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: any, @Res() res: any) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    if (state?.startsWith('bind:')) {
      return this.handleBindCallback(code, state, res, frontendUrl);
    }
    return this.handleLoginCallback(req, res, frontendUrl);
  }

  private async handleLoginCallback(req: any, res: any, frontendUrl: string) {
    try {
      const clientId = this.config.get('GITHUB_CLIENT_ID');
      const clientSecret = this.config.get('GITHUB_CLIENT_SECRET');
      const callbackUrl = this.config.get('GITHUB_CALLBACK_URL');
      const code = req.query?.code;
      if (!code) return res.redirect(`${frontendUrl}/login?error=no_code`);
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) {
        console.error('[GitHub Login] Token exchange failed:', tokenData);
        return res.redirect(`${frontendUrl}/login?error=exchange_failed`);
      }
      const profileRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'SafuSkill-OAuth-App', Accept: 'application/vnd.github.v3+json' },
      });
      const profile = await profileRes.json() as any;
      if (!profile.id) {
        console.error('[GitHub Login] Profile fetch failed:', profile);
        return res.redirect(`${frontendUrl}/login?error=profile_failed`);
      }
      const normalizedProfile = {
        id: profile.id,
        username: profile.login,
        displayName: profile.name,
        emails: profile.email ? [{ value: profile.email }] : [],
        photos: profile.avatar_url ? [{ value: profile.avatar_url }] : [],
      };
      const user = await this.authService.validateGitHubUser(normalizedProfile, tokenData.access_token);
      if (!user) return res.redirect(`${frontendUrl}/login?error=auth_failed`);
      const token = this.jwtService.sign({ sub: user.id, username: user.username });
      const requiresWallet = user.walletRequired && !user.walletAddress ? '&requiresWallet=1' : '';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}${requiresWallet}`);
    } catch (error) {
      console.error('[GitHub Callback] Error:', error);
      res.redirect(`${frontendUrl}/login?error=callback_error`);
    }
  }

  private async handleBindCallback(code: string, state: string, res: any, frontendUrl: string) {
    try {
      const jwt = state.slice(5);
      let payload: any;
      try {
        payload = this.jwtService.verify(jwt);
      } catch {
        return res.redirect(`${frontendUrl}/auth/github-bind-callback?error=invalid_token`);
      }
      const userId = payload.sub;
      const clientId = this.config.get('GITHUB_CLIENT_ID');
      const clientSecret = this.config.get('GITHUB_CLIENT_SECRET');
      const callbackUrl = this.config.get('GITHUB_CALLBACK_URL');
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl }),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) {
        console.error('[GitHub Bind] Token exchange failed:', tokenData);
        return res.redirect(`${frontendUrl}/auth/github-bind-callback?error=exchange_failed`);
      }
      const profileRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'SafuSkill-OAuth-App', Accept: 'application/vnd.github.v3+json' },
      });
      const profile = await profileRes.json() as any;
      if (!profile.id) {
        console.error('[GitHub Bind] Profile fetch failed:', profile);
        const errMsg = profile.message?.includes('rate limit') ? 'github_rate_limit' : 'profile_failed';
        return res.redirect(`${frontendUrl}/auth/github-bind-callback?error=${errMsg}`);
      }
      await this.authService.bindGithub(userId, profile, tokenData.access_token);
      return res.redirect(`${frontendUrl}/auth/github-bind-callback?success=1`);
    } catch (err: any) {
      console.error('[GitHub Bind] Error:', err);
      return res.redirect(`${frontendUrl}/auth/github-bind-callback?error=${encodeURIComponent(err.message || 'bind_failed')}`);
    }
  }

  @Get('github/bind-url')
  @UseGuards(JwtAuthGuard)
  getGithubBindUrl(@Req() req: any) {
    const clientId = this.config.get('GITHUB_CLIENT_ID');
    const callbackUrl = this.config.get('GITHUB_CALLBACK_URL');
    const token = req.headers.authorization?.replace('Bearer ', '');
    const state = `bind:${token}`;
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=user:email&state=${encodeURIComponent(state)}`;
    return { url };
  }

  @Get('wallet/check')
  async checkWalletAddress(@Query('address') address: string) {
    return this.authService.checkWalletAddress(address);
  }

  @Get('wallet/nonce')
  getWalletNonce(@Query('address') address: string) {
    const nonce = this.authService.getNonce(address);
    return { nonce };
  }

  @Post('wallet/login')
  walletLogin(@Body() dto: WalletLoginDto) {
    return this.authService.walletLogin(dto);
  }

  @Post('wallet/bind')
  @UseGuards(JwtAuthGuard)
  bindWallet(@CurrentUser() user: any, @Body('address') address: string) {
    return this.authService.bindWallet(user.id, address);
  }
}
