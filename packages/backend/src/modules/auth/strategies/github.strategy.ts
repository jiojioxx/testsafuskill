import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: config.get('GITHUB_CLIENT_ID'),
      clientSecret: config.get('GITHUB_CLIENT_SECRET'),
      callbackURL: config.get('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
      userAgent: 'SafuSkill-OAuth-App',
    }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      // 自定义验证函数来处理邮箱获取失败的情况
      try {
        console.log('[GitHub Strategy] Custom verification started');
        console.log('[GitHub Strategy] Profile from GitHub:', {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          emails: profile.emails?.length || 0,
          photos: profile.photos?.length || 0
        });

        // 如果 passport 没有获取到邮箱，尝试手动获取
        if (!profile.emails || profile.emails.length === 0) {
          console.log('[GitHub Strategy] No emails in profile, attempting manual fetch...');
          try {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
              headers: {
                'Authorization': `token ${accessToken}`,
                'User-Agent': 'SafuSkill-OAuth-App',
                'Accept': 'application/vnd.github.v3+json'
              }
            });
            
            if (emailResponse.ok) {
              const emails = await emailResponse.json();
              console.log('[GitHub Strategy] Manually fetched emails:', emails.length);
              profile.emails = emails.map((email: any) => ({ value: email.email, primary: email.primary }));
            } else {
              console.log('[GitHub Strategy] Manual email fetch failed:', emailResponse.status);
            }
          } catch (emailError) {
            console.log('[GitHub Strategy] Manual email fetch error:', emailError.message);
          }
        }

        const result = await this.authService.validateGitHubUser(profile, accessToken);
        console.log('[GitHub Strategy] Validation completed successfully for user:', result.id);
        
        return done(null, result);
      } catch (error) {
        console.error('[GitHub Strategy] Validation error:', error);
        console.error('[GitHub Strategy] Error stack:', error.stack);
        return done(error, null);
      }
    });
  }

  async validate(accessToken: string, _refreshToken: string, profile: any) {
    // 这个方法不会被调用，因为我们在构造函数中提供了自定义验证函数
    try {
      console.log('[GitHub Strategy] Fallback validation method called');
      const result = await this.authService.validateGitHubUser(profile, accessToken);
      return result;
    } catch (error) {
      console.error('[GitHub Strategy] Fallback validation error:', error);
      throw error;
    }
  }
}
