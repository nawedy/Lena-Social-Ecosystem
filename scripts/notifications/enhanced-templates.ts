import { NotificationTemplate } from './types';

export const enhancedTemplates: Record<string, NotificationTemplate> = {
  securityBreach: {
    title: '🚨 SECURITY BREACH DETECTED',
    template: `
SECURITY BREACH ALERT
--------------------
Severity: {{severity}}
Environment: {{environment}}
Time: {{timestamp}}
Location: {{location}}

Breach Details:
- Type: {{breach_type}}
- Attack Vector: {{attack_vector}}
- Data Compromised: {{compromised_data}}
- Affected Users: {{affected_users_count}}
- Breach Duration: {{duration}}

Immediate Actions Taken:
{{#each automated_actions}}
- {{timestamp}}: {{action}} - Status: {{status}}
  Details: {{details}}
{{/each}}

Current Containment Status:
- Breach Contained: {{containment_status}}
- Data Access: {{data_access_status}}
- System Integrity: {{system_integrity_status}}

Required Actions:
{{#each required_actions}}
1. [{{priority}}] {{action}}
   Assigned: {{assigned_to}}
   Deadline: {{deadline}}
{{/each}}

Forensics Summary:
{{#each forensics_findings}}
- {{timestamp}}: {{finding}}
  Evidence: {{evidence_link}}
{{/each}}

Compliance Impact:
{{#each compliance_impacts}}
- {{regulation}}: {{impact_description}}
  Required Reporting: {{reporting_deadline}}
{{/each}}

Response Team:
{{#each team_members}}
- {{role}}: {{name}} ({{contact}})
{{/each}}

Links:
- Incident Dashboard: {{dashboard_url}}
- Response Playbook: {{playbook_url}}
- Evidence Collection: {{evidence_url}}
- Status Page: {{status_page_url}}

Next Update Expected: {{next_update_time}}
Incident ID: {{incident_id}}
    `,
    channels: ['slack', 'email', 'sms', 'pagerduty'],
    priority: 'critical',
    requireAcknowledgment: true,
    escalationPolicy: {
      initialDelay: '5m',
      escalationSteps: [
        {
          delay: '15m',
          notifyRoles: ['security-lead', 'cto']
        },
        {
          delay: '30m',
          notifyRoles: ['ceo', 'legal-team']
        }
      ]
    }
  }
}; 