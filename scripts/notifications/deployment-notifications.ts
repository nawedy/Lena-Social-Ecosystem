import { SlackNotifier } from '../utils/notifications/slack';
import { EmailNotifier } from '../utils/notifications/email';
import { PagerDutyNotifier } from '../utils/notifications/pagerduty';

interface NotificationConfig {
  channels: {
    slack: {
      default: string;
      urgent: string;
    };
    email: {
      lists: string[];
    };
    pagerduty: {
      serviceId: string;
    };
  };
  templates: {
    [key: string]: string;
  };
}

export class DeploymentNotifier {
  private slack: SlackNotifier;
  private email: EmailNotifier;
  private pagerduty: PagerDutyNotifier;
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.slack = new SlackNotifier();
    this.email = new EmailNotifier();
    this.pagerduty = new PagerDutyNotifier();
  }

  async notifyDeploymentStart(environment: string, version: string): Promise<void> {
    const message = `🚀 Deployment started
Environment: ${environment}
Version: ${version}
Time: ${new Date().toISOString()}`;

    await this.slack.send(this.config.channels.slack.default, message);
    await this.email.send(this.config.channels.email.lists, 'Deployment Started', message);
  }

  async notifyDeploymentSuccess(environment: string, version: string, metrics: any): Promise<void> {
    const message = `✅ Deployment successful
Environment: ${environment}
Version: ${version}
Duration: ${metrics.duration}
Health Score: ${metrics.healthScore}
Time: ${new Date().toISOString()}`;

    await this.slack.send(this.config.channels.slack.default, message);
    await this.email.send(this.config.channels.email.lists, 'Deployment Successful', message);
  }

  async notifyDeploymentFailure(environment: string, version: string, error: Error): Promise<void> {
    const message = `❌ Deployment failed
Environment: ${environment}
Version: ${version}
Error: ${error.message}
Time: ${new Date().toISOString()}`;

    await this.slack.send(this.config.channels.slack.urgent, message);
    await this.email.send(this.config.channels.email.lists, 'URGENT: Deployment Failed', message);
    await this.pagerduty.createIncident({
      title: `Deployment Failure - ${environment}`,
      description: error.message,
      severity: 'critical'
    });
  }

  async notifySecurityIssue(environment: string, issue: any): Promise<void> {
    const message = `🚨 Security Issue Detected
Environment: ${environment}
Type: ${issue.type}
Severity: ${issue.severity}
Details: ${issue.details}
Time: ${new Date().toISOString()}`;

    await this.slack.send(this.config.channels.slack.urgent, message);
    await this.email.send(this.config.channels.email.lists, 'URGENT: Security Issue', message);
    if (issue.severity === 'critical') {
      await this.pagerduty.createIncident({
        title: `Security Issue - ${environment}`,
        description: issue.details,
        severity: 'critical'
      });
    }
  }
} 