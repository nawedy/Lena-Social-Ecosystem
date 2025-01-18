import { google } from 'googleapis';
import nodemailer from 'nodemailer';

import { config } from '../config';

class EmailService {
  private transporter: nodemailer.Transporter;
  private logger: Console;

  constructor() {
    this.logger = console;
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.email.clientId,
        config.email.clientSecret,
        config.email.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: config.email.refreshToken,
      });

      const accessToken = await oauth2Client.getAccessToken();

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: config.email.senderEmail,
          clientId: config.email.clientId,
          clientSecret: config.email.clientSecret,
          refreshToken: config.email.refreshToken,
          accessToken: accessToken?.token!,
        },
      });
    } catch (error) {
      this.logger.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      const mailOptions = {
        from: config.email.senderEmail,
        to,
        subject,
        text,
        html: html || text,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    const subject = 'Welcome to TikTokToe!';
    const text = `Hi ${username},\n\nWelcome to TikTokToe! We're excited to have you on board.\n\nBest regards,\nThe TikTokToe Team`;
    const html = `
      <h1>Welcome to TikTokToe!</h1>
      <p>Hi ${username},</p>
      <p>Welcome to TikTokToe! We're excited to have you on board.</p>
      <p>Best regards,<br>The TikTokToe Team</p>
    `;

    await this.sendEmail(to, subject, text, html);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetLink = `${config.app.baseUrl}/reset-password?token=${resetToken}`;
    const subject = 'Reset Your Password';
    const text = `Please click the following link to reset your password: ${resetLink}`;
    const html = `
      <h1>Reset Your Password</h1>
      <p>Please click the following link to reset your password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
    `;

    await this.sendEmail(to, subject, text, html);
  }

  async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
    const verificationLink = `${config.app.baseUrl}/verify-email?token=${verificationToken}`;
    const subject = 'Verify Your Email';
    const text = `Please click the following link to verify your email: ${verificationLink}`;
    const html = `
      <h1>Verify Your Email</h1>
      <p>Please click the following link to verify your email:</p>
      <p><a href="${verificationLink}">Verify Email</a></p>
    `;

    await this.sendEmail(to, subject, text, html);
  }
}

export const emailService = new EmailService();
