import nodemailer from 'nodemailer';
import { EmailConfig } from './types';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send an email
   */
  async sendEmail(config: EmailConfig): Promise<void> {
    try {
      const { to, subject, text, html, from = process.env.SMTP_FROM } = config;

      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send a template-based email
   */
  async sendTemplateEmail(config: EmailConfig & { template: string; data: Record<string, any> }): Promise<void> {
    try {
      const { template, data, ...emailConfig } = config;

      // Here you would typically:
      // 1. Load the template
      // 2. Replace variables with data
      // 3. Send the email
      
      // For now, we'll just use a simple implementation
      const html = this.renderTemplate(template, data);
      
      await this.sendEmail({
        ...emailConfig,
        html
      });
    } catch (error) {
      console.error('Failed to send template email:', error);
      throw new Error('Failed to send template email');
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email configuration verification failed:', error);
      return false;
    }
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    // Simple template rendering implementation
    // In a real application, you might want to use a proper template engine like handlebars
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }
}

// Export a singleton instance
export const emailService = new EmailService(); 