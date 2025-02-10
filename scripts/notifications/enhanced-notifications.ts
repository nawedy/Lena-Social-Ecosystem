import { DeploymentNotifier } from './deployment-notifications';
import { TeamsNotifier } from '../utils/notifications/teams';
import { TelegramNotifier } from '../utils/notifications/telegram';
import { WebhookNotifier } from '../utils/notifications/webhook';
import { JiraNotifier } from '../utils/notifications/jira';
import { AutomatedResponse } from '../utils/automated-response';

interface EnhancedNotificationConfig extends NotificationConfig {
  teams?: {
    webhook: string;
    channel: string;
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
  jira?: {
    project: string;
    issueType: string;
  };
  automatedResponses: {
    enabled: boolean;
    rules: AutomatedResponseRule[];
  };
}

interface AutomatedResponseRule {
  condition: {
    type: string;
    threshold: number;
    duration: string;
  };
  actions: {
    type: string;
    params: Record<string, any>;
  }[];
}

export class EnhancedDeploymentNotifier extends DeploymentNotifier {
  private teams?: TeamsNotifier;
  private telegram?: TelegramNotifier;
  private jira?: JiraNotifier;
  private webhook: WebhookNotifier;
  private automatedResponse: AutomatedResponse;

  constructor(config: EnhancedNotificationConfig) {
    super(config);
    
    if (config.teams) {
      this.teams = new TeamsNotifier(config.teams);
    }
    if (config.telegram) {
      this.telegram = new TelegramNotifier(config.telegram);
    }
    if (config.jira) {
      this.jira = new JiraNotifier(config.jira);
    }
    
    this.webhook = new WebhookNotifier();
    this.automatedResponse = new AutomatedResponse(config.automatedResponses);
  }

  async notifySecurityIssue(environment: string, issue: any): Promise<void> {
    await super.notifySecurityIssue(environment, issue);

    // Additional notifications
    if (this.teams) {
      await this.teams.sendSecurityAlert(issue);
    }
    if (this.jira) {
      await this.jira.createSecurityIssue(issue);
    }

    // Automated response
    if (issue.severity === 'critical') {
      await this.automatedResponse.handleSecurityIssue(issue);
    }
  }

  async notifyPerformanceIssue(environment: string, metrics: any): Promise<void> {
    const message = this.formatPerformanceMessage(environment, metrics);
    
    await this.slack.send(this.config.channels.slack.default, message);
    
    if (metrics.severity === 'critical') {
      await this.automatedResponse.handlePerformanceIssue(metrics);
    }
  }

  async notifyComplianceIssue(environment: string, violation: any): Promise<void> {
    const message = this.formatComplianceMessage(environment, violation);
    
    await this.slack.send(this.config.channels.slack.urgent, message);
    await this.email.send(this.config.channels.email.lists, 'Compliance Violation', message);
    
    if (this.jira) {
      await this.jira.createComplianceIssue(violation);
    }

    await this.automatedResponse.handleComplianceIssue(violation);
  }

  private formatPerformanceMessage(environment: string, metrics: any): string {
    return `🔍 Performance Issue Detected
Environment: ${environment}
Type: ${metrics.type}
Current Value: ${metrics.value}
Threshold: ${metrics.threshold}
Impact: ${metrics.impact}
Time: ${new Date().toISOString()}`;
  }

  private formatComplianceMessage(environment: string, violation: any): string {
    return `⚠️ Compliance Violation Detected
Environment: ${environment}
Policy: ${violation.policy}
Severity: ${violation.severity}
Details: ${violation.details}
Required Action: ${violation.requiredAction}
Time: ${new Date().toISOString()}`;
  }
} 