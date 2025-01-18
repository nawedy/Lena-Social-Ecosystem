import sgMail from '@sendgrid/mail';
import { AnalyticsService } from './AnalyticsService';

export interface EmailTemplate {
  id: string;
  data: Record<string, any>;
}

export class EmailService {
  private static instance: EmailService;
  private analytics: AnalyticsService;

  private constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    this.analytics = AnalyticsService.getInstance();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendWelcomeEmail(email: string, inviteCode: string): Promise<void> {
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME!,
        },
        templateId: process.env.WELCOME_TEMPLATE_ID!,
        dynamicTemplateData: {
          INVITE_CODE: inviteCode,
          APP_STORE_LINK: 'https://apps.apple.com/app/tiktok-toe',
          PLAY_STORE_LINK:
            'https://play.google.com/store/apps/details?id=com.tiktok.toe',
        },
      });

      this.analytics.trackEvent('welcome_email_sent', {
        email,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      this.analytics.trackEvent('welcome_email_failed', {
        email,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  async sendFeedbackResponse(
    email: string,
    feedback: {
      title: string;
      category: string;
      type: string;
      status: string;
      submissionDate: Date;
      teamResponse: string;
      nextSteps: string;
      relatedIssues?: string[];
    }
  ): Promise<void> {
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME!,
        },
        templateId: process.env.FEEDBACK_RESPONSE_TEMPLATE_ID!,
        dynamicTemplateData: {
          FEEDBACK_TITLE: feedback.title,
          FEEDBACK_CATEGORY: feedback.category,
          FEEDBACK_TYPE: feedback.type,
          FEEDBACK_STATUS: feedback.status,
          SUBMISSION_DATE: feedback.submissionDate.toLocaleDateString(),
          TEAM_RESPONSE: feedback.teamResponse,
          NEXT_STEPS: feedback.nextSteps,
          RELATED_ISSUES: feedback.relatedIssues || [],
        },
      });

      this.analytics.trackEvent('feedback_response_sent', {
        email,
        feedbackTitle: feedback.title,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending feedback response:', error);
      this.analytics.trackEvent('feedback_response_failed', {
        email,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  async sendWeeklyUpdate(
    email: string,
    data: {
      weekDate: string;
      activeUsers: number;
      gamesPlayed: number;
      feedbackCount: number;
      updates: Array<{
        type: 'new' | 'improved' | 'fixed';
        title: string;
        description: string;
        screenshot?: string;
      }>;
      comingSoon: string[];
      feedbackHighlights: string[];
    }
  ): Promise<void> {
    try {
      await sgMail.send({
        to: email,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME!,
        },
        templateId: process.env.WEEKLY_UPDATE_TEMPLATE_ID!,
        dynamicTemplateData: {
          WEEK_DATE: data.weekDate,
          ACTIVE_USERS: data.activeUsers,
          GAMES_PLAYED: data.gamesPlayed,
          FEEDBACK_COUNT: data.feedbackCount,
          UPDATES: data.updates,
          COMING_SOON: data.comingSoon,
          FEEDBACK_HIGHLIGHTS: data.feedbackHighlights,
        },
      });

      this.analytics.trackEvent('weekly_update_sent', {
        email,
        weekDate: data.weekDate,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending weekly update:', error);
      this.analytics.trackEvent('weekly_update_failed', {
        email,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  async sendBatchWeeklyUpdate(
    emails: string[],
    data: {
      weekDate: string;
      activeUsers: number;
      gamesPlayed: number;
      feedbackCount: number;
      updates: Array<{
        type: 'new' | 'improved' | 'fixed';
        title: string;
        description: string;
        screenshot?: string;
      }>;
      comingSoon: string[];
      feedbackHighlights: string[];
    }
  ): Promise<void> {
    try {
      const personalizations = emails.map(email => ({
        to: email,
        dynamicTemplateData: {
          WEEK_DATE: data.weekDate,
          ACTIVE_USERS: data.activeUsers,
          GAMES_PLAYED: data.gamesPlayed,
          FEEDBACK_COUNT: data.feedbackCount,
          UPDATES: data.updates,
          COMING_SOON: data.comingSoon,
          FEEDBACK_HIGHLIGHTS: data.feedbackHighlights,
        },
      }));

      await sgMail.send({
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: process.env.SENDGRID_FROM_NAME!,
        },
        templateId: process.env.WEEKLY_UPDATE_TEMPLATE_ID!,
        personalizations,
      });

      this.analytics.trackEvent('batch_weekly_update_sent', {
        emailCount: emails.length,
        weekDate: data.weekDate,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error sending batch weekly update:', error);
      this.analytics.trackEvent('batch_weekly_update_failed', {
        emailCount: emails.length,
        error: error.message,
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}
