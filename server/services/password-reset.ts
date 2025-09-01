// SendGrid service removed in OAuth-first architecture migration
// SendGrid MailService removed in OAuth-first architecture migration
import { storage } from '../storage';
import { logger } from './logger';
import { SendGridService } from './sendgrid';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import type { Request } from 'express';

export class PasswordResetService {
  private sendGridService: SendGridService;

  constructor() {
    this.sendGridService = new SendGridService();
  }

  private isValidEmailForProduction(email: string): boolean {
    // Block test/demo/invalid email patterns that damage sender reputation
    const blockedPatterns = [
      /^test/i,
      /^demo/i,
      /example\.com$/i,
      /test\.com$/i,
      /\.test$/i,
      /user\d+/i,
      /demo_/i,
      /\+test/i,
      /noreply/i,
      /donotreply/i
    ];
    
    return !blockedPatterns.some(pattern => pattern.test(email));
  }

  private generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getClientInfo(req?: Request) {
    return {
      ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
      userAgent: req?.get('User-Agent') || 'unknown'
    };
  }

  private async logPasswordResetAction(
    action: string, 
    status: 'success' | 'failed' | 'error', 
    email: string, 
    userId?: string, 
    tokenId?: string, 
    errorMessage?: string,
    sendgridResponse?: any,
    req?: Request
  ): Promise<void> {
    try {
      const clientInfo = this.getClientInfo(req);
      await storage.createPasswordResetLog({
        email,
        userId,
        action,
        status,
        tokenId,
        sendgridResponse,
        errorMessage,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        metadata: { timestamp: new Date().toISOString() }
      });
      
      logger.info(`[PasswordReset] ${action} - ${status} for ${email}`, JSON.stringify({
        action,
        status,
        email,
        userId,
        tokenId,
        errorMessage,
        ipAddress: clientInfo.ipAddress
      }));
    } catch (logError) {
      logger.error('[PasswordReset] Failed to log password reset action', String(logError));
    }
  }

  async requestPasswordReset(email: string, req?: Request): Promise<{ success: boolean; message: string }> {
    try {
      // Log the password reset request
      await this.logPasswordResetAction('request', 'success', email, undefined, undefined, undefined, undefined, req);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Log that no user was found (but still return success for security)
        await this.logPasswordResetAction('user_lookup', 'failed', email, undefined, undefined, 'User not found', undefined, req);
        
        // Return success even if user doesn't exist (security best practice)
        return {
          success: true,
          message: 'If an account with that email exists, you will receive a password reset link.'
        };
      }

      // Log successful user lookup
      await this.logPasswordResetAction('user_lookup', 'success', email, user.id, undefined, undefined, undefined, req);

      // Generate reset token
      const token = this.generateResetToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

      // Store the token
      const resetToken = await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: false
      });
      
      // Log successful token generation
      await this.logPasswordResetAction('token_generated', 'success', email, user.id, resetToken.id, undefined, undefined, req);

      // CRITICAL: Validate email before sending to protect sender reputation
      if (!this.isValidEmailForProduction(email)) {
        const { reputationMonitor } = await import('./reputation-monitor');
        await reputationMonitor.logBlockedEmail(
          email,
          'PasswordReset',
          'Invalid/test email pattern detected',
          'Password reset request'
        );
        await this.logPasswordResetAction('email_blocked', 'success', email, user.id, resetToken.id, 'Email blocked to protect sender reputation', undefined, req);
        // Return success to not reveal if account exists (security)
        return {
          success: true,
          message: 'If an account with that email exists, you will receive a password reset link.'
        };
      }

      // Send password reset email - always use production domain
      const resetUrl = `https://delightdesk.io/reset-password?token=${token}`;
      
      try {
        const emailSuccess = await this.sendGridService.sendEmail(
          email,
          'Reset Your Delight Desk Password',
          this.generateResetEmailHtml(resetUrl),
          'remy@delightdesk.io',
          'Remy at Delight Desk'
        );
        
        if (!emailSuccess) {
          throw new Error('Email sending failed');
        }
        
        // Log successful email send
        await this.logPasswordResetAction('email_sent', 'success', email, user.id, resetToken.id, undefined, { success: emailSuccess }, req);
        
        logger.info(`[PasswordReset] Password reset email sent to ${email}`, JSON.stringify({ success: true }));
      } catch (emailError) {
        // Log failed email send
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        await this.logPasswordResetAction('email_failed', 'error', email, user.id, resetToken.id, errorMessage, undefined, req);
        
        logger.error(`[PasswordReset] Failed to send password reset email to ${email}`, String(emailError));
        
        return {
          success: false,
          message: 'Failed to send reset email. Please try again later.'
        };
      }
      
      return {
        success: true,
        message: 'If an account with that email exists, you will receive a password reset link.'
      };
    } catch (error) {
      // Log the overall error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logPasswordResetAction('request', 'error', email, undefined, undefined, errorMessage, undefined, req);
      
      logger.error('[PasswordReset] Error in requestPasswordReset', String(error));
      throw new Error('Failed to process password reset request');
    }
  }

  async resetPassword(token: string, newPassword: string, req?: Request): Promise<{ success: boolean; message: string }> {
    let email = 'unknown';
    let userId: string | undefined;
    let tokenId: string | undefined;
    
    try {
      // Find valid token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        await this.logPasswordResetAction('token_validated', 'failed', email, undefined, undefined, 'Invalid or expired token', undefined, req);
        
        return {
          success: false,
          message: 'Invalid or expired reset token.'
        };
      }
      
      tokenId = resetToken.id;
      userId = resetToken.userId;
      
      // Get user to log email
      const user = await storage.getUser(resetToken.userId);
      if (user) {
        email = user.email;
      }
      
      // Log successful token validation
      await this.logPasswordResetAction('token_validated', 'success', email, userId, tokenId, undefined, undefined, req);

      // Update user password (storage layer handles hashing)
      await storage.updateUserPassword(resetToken.userId, newPassword);

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);
      
      // Log successful password change
      await this.logPasswordResetAction('password_changed', 'success', email, userId, tokenId, undefined, undefined, req);

      logger.info('PasswordReset', `Password reset successful for user ${resetToken.userId}`);

      return {
        success: true,
        message: 'Password reset successful. You can now log in with your new password.'
      };

    } catch (error) {
      // Log the overall error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logPasswordResetAction('password_change', 'error', email, userId, tokenId, errorMessage, undefined, req);
      
      logger.error('[PasswordReset] Error in resetPassword', String(error));
      return {
        success: false,
        message: 'Failed to reset password. Please try again.'
      };
    }
  }

  async validateResetToken(token: string, req?: Request): Promise<{ valid: boolean; message?: string }> {
    let email = 'unknown';
    let userId: string | undefined;
    let tokenId: string | undefined;
    
    try {
      // Find token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        await this.logPasswordResetAction('token_validated', 'failed', email, undefined, undefined, 'Token not found', undefined, req);
        
        return {
          valid: false,
          message: 'Invalid reset token.'
        };
      }
      
      tokenId = resetToken.id;
      userId = resetToken.userId;
      
      // Get user email for logging
      const user = await storage.getUser(resetToken.userId);
      if (user) {
        email = user.email;
      }
      
      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        await this.logPasswordResetAction('token_expired', 'failed', email, userId, tokenId, 'Token expired', undefined, req);
        
        return {
          valid: false,
          message: 'Reset token has expired.'
        };
      }
      
      // Check if token has been used
      if (resetToken.used) {
        await this.logPasswordResetAction('token_validated', 'failed', email, userId, tokenId, 'Token already used', undefined, req);
        
        return {
          valid: false,
          message: 'Reset token has already been used.'
        };
      }
      
      // Log successful validation
      await this.logPasswordResetAction('token_validated', 'success', email, userId, tokenId, undefined, undefined, req);
      
      return {
        valid: true,
        message: 'Token is valid.'
      };
    } catch (error) {
      // Log the overall error
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logPasswordResetAction('token_validation', 'error', email, userId, tokenId, errorMessage, undefined, req);
      
      logger.error('[PasswordReset] Error in validateResetToken', String(error));
      return {
        valid: false,
        message: 'Failed to validate token.'
      };
    }
  }

  private generateResetEmailHtml(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>You requested a password reset for your Delight Desk account. Click the button below to set a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>Delight Desk is currently in Beta. If you have any problems resetting your password just reply back to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateResetEmailText(resetUrl: string): string {
    return `
Reset Your Password

Hi there,

You requested a password reset for your Delight Desk account. 

Click this link to reset your password: ${resetUrl}

This link will expire in 1 hour.

Delight Desk is currently in Beta. If you have any problems resetting your password just reply back to this email.
    `.trim();
  }
}

export const passwordResetService = new PasswordResetService();