import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { getRequiredEnv } from '../config/env.validation';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly emailFrom: string;

  constructor() {
    // Read from validated env vars
    const host = getRequiredEnv('EMAIL_HOST');
    const port = Number(getRequiredEnv('EMAIL_PORT'));
    const user = getRequiredEnv('EMAIL_USER');
    const pass = getRequiredEnv('EMAIL_PASS');
    this.emailFrom = getRequiredEnv('EMAIL_FROM');

    // Create transport with validated credentials
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    // Verify transporter and fallback to Ethereal if verification fails in dev
    (async () => {
      try {
        await this.transporter.verify();
        this.logger.log('SMTP transporter verified');
      } catch (err) {
        this.logger.warn('SMTP transporter could not be verified', err);
        if (getRequiredEnv('NODE_ENV') !== 'production') {
          this.logger.log(
            'Falling back to Ethereal test account for development',
          );
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          this.logger.log(`Ethereal account user: ${testAccount.user}`);
        } else {
          this.logger.error(
            'SMTP transporter verification failed in production',
            err,
          );
        }
      }
    })();
  }

  async sendResetPasswordEmail(
    to: string,
    name: string | undefined,
    resetUrl: string,
  ) {
    const displayName = name || 'Brooklin Admin';
    const mailOptions = {
      from: this.emailFrom,
      to,
      subject: 'Reset your Brooklin Admin password',
      text: `Hello ${displayName},\n\nWe received a request to reset your password for Brooklin Admin. Use the link below to set a new password. This link will expire in 1 hour.\n\n${resetUrl}\n\nIf you did not request a password reset, you can safely ignore this email.`,
      html: `<p>Hello ${displayName},</p><p>We received a request to reset your Brooklin Admin password. Click the link below to reset it — the link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this email.</p>`,
    } as any;

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Reset password email sent to ${to}. Info: ${JSON.stringify(info)}`,
      );
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
      return info;
    } catch (err) {
      this.logger.error('Failed to send reset email', err);
      throw err;
    }
  }

  async sendPasswordChangedConfirmation(to: string, name: string | undefined) {
    const displayName = name || 'Brooklin Admin';
    const mailOptions = {
      from: this.emailFrom,
      to,
      subject: 'Your Brooklin Admin password was changed',
      text: `Hello ${displayName},\n\nThis is a confirmation that your Brooklin Admin password was successfully changed. If you did not perform this action, please contact support immediately.`,
      html: `<p>Hello ${displayName},</p><p>Your Brooklin Admin password was successfully changed. If you did not perform this action, please contact support immediately.</p>`,
    } as any;

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Password changed confirmation email sent to ${to}. Info: ${JSON.stringify(info)}`,
      );
      return info;
    } catch (err) {
      this.logger.error('Failed to send confirmation email', err);
      // Don't block password reset even if mail fails
    }
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    verificationUrl: string,
  ) {
    const displayName = name || 'Admin';
    const mailOptions = {
      from: this.emailFrom,
      to,
      subject: 'Verify your Brooklin Pub Admin email address',
      text: `Hello ${displayName},\n\nWelcome to Brooklin Pub Admin Dashboard! Please verify your email address by clicking the link below. This link will expire in 10 minutes.\n\n${verificationUrl}\n\nIf you did not create an account, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d4a574;">Welcome to Brooklin Pub Admin!</h2>
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Thank you for joining the Brooklin Pub Admin Dashboard. To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">This verification link will expire in 10 minutes. If you didn't create this account, please ignore this email.</p>
        </div>
      `,
    } as any;

    if (getRequiredEnv('NODE_ENV') !== 'production') {
      this.logger.debug(
        `Sending verification email to ${to} with url: ${verificationUrl}`,
      );
    }
    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Verification email sent to ${to}. Info: ${JSON.stringify(info)}`,
      );
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
      return info;
    } catch (err) {
      this.logger.error('Failed to send verification email', err);
      throw err;
    }
  }

  async sendVerificationSuccessEmail(to: string, name: string) {
    const displayName = name || 'Admin';
    const loginUrl = `${getRequiredEnv('ADMIN_FRONTEND_URL')}/login`;
    const mailOptions = {
      from: this.emailFrom,
      to,
      subject: 'Email verified successfully - Brooklin Pub Admin',
      text: `Hello ${displayName},\n\nYour email has been successfully verified! You can now log in to the Brooklin Pub Admin Dashboard at ${loginUrl}.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4caf50;">Email Verified Successfully!</h2>
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>Great news! Your email address has been successfully verified. You can now log in to your Brooklin Pub Admin Dashboard.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #d4a574; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Go to Login</a>
          </div>
          <p>Welcome to the team!</p>
        </div>
      `,
    } as any;

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Verification success email sent to ${to}. Info: ${JSON.stringify(info)}`,
      );
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) this.logger.log(`Preview URL: ${preview}`);
      return info;
    } catch (err) {
      this.logger.error('Failed to send verification success email', err);
      // Don't block verification even if mail fails
    }
  }
}
