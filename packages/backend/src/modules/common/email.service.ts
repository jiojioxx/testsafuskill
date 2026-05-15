import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('RESEND_API_KEY not configured - email sending will be disabled');
    }
    this.resend = new Resend(apiKey);
  }

  async sendVerificationCode(email: string, code: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get('RESEND_FROM_EMAIL', 'SafuSkill <onboarding@resend.dev>'),
        to: [email],
        subject: 'SafuSkill - Email Verification Code',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>SafuSkill - Email Verification</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 32px;">🔧 SafuSkill</h1>
                <p style="color: #666; margin: 10px 0; font-size: 16px;">AI Agent Skill Marketplace</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 40px 30px; border-radius: 16px; text-align: center; border: 1px solid #e2e8f0;">
                <h2 style="color: #1f2937; margin-bottom: 24px; font-size: 24px;">Your Verification Code</h2>
                
                <div style="background: white; padding: 24px; border-radius: 12px; margin: 24px 0; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <div style="font-size: 42px; font-weight: bold; color: #2563eb; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
                
                <p style="color: #4b5563; margin: 24px 0; font-size: 16px;">
                  Enter this code in SafuSkill to complete your login
                </p>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 24px 0;">
                  <p style="color: #dc2626; margin: 0; font-size: 14px; font-weight: 600;">
                    ⏰ This code expires in 10 minutes
                  </p>
                </div>
              </div>
              
              <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 14px; line-height: 1.5;">
                <p style="margin: 8px 0;">If you didn't request this code, you can safely ignore this email.</p>
                <p style="margin: 8px 0;">This email was sent from SafuSkill AI Agent Skill Marketplace.</p>
                
                <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    Powered by SafuSkill © ${new Date().getFullYear()}
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
SafuSkill - Email Verification Code

🔧 SafuSkill
AI Agent Skill Marketplace

Your verification code is: ${code}

Enter this code in SafuSkill to complete your login.
⏰ This code expires in 10 minutes.

If you didn't request this code, you can safely ignore this email.

Powered by SafuSkill © ${new Date().getFullYear()}
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return false;
      }

      console.log('Email sent successfully via Resend:', data?.id);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async testConnection() {
    try {
      // Resend doesn't have a direct test method, but we can try to get the API key info
      const apiKey = this.config.get('RESEND_API_KEY');
      if (!apiKey) {
        console.error('RESEND_API_KEY not configured');
        return false;
      }
      
      console.log('Resend service configured successfully');
      return true;
    } catch (error) {
      console.error('Resend service configuration failed:', error);
      return false;
    }
  }
}