export const notificationTemplates = {
  security: {
    critical: {
      title: '🚨 CRITICAL SECURITY ALERT',
      template: `
SECURITY INCIDENT DETECTED
-------------------------
Severity: {{severity}}
Environment: {{environment}}
Time: {{timestamp}}

Issue Details:
- Type: {{type}}
- Source: {{source}}
- Impact: {{impact}}
- Affected Systems: {{affected_systems}}

Automated Actions Taken:
{{#each actions}}
- {{this.type}}: {{this.result}}
{{/each}}

Current Status:
- Containment: {{containment_status}}
- Investigation: {{investigation_status}}
- Mitigation: {{mitigation_status}}

Required Actions:
{{#each required_actions}}
1. {{this}}
{{/each}}

Response Team: @{{team}}
Incident ID: {{incident_id}}
Dashboard: {{dashboard_url}}
      `
    },
    performance: {
      title: '⚠️ Performance Degradation Alert',
      template: `
PERFORMANCE ISSUE DETECTED
-------------------------
Environment: {{environment}}
Service: {{service}}
Time: {{timestamp}}

Metrics:
- Current Value: {{current_value}}
- Threshold: {{threshold}}
- Duration: {{duration}}
- Impact Level: {{impact_level}}

Affected Components:
{{#each affected_components}}
- {{this.name}}: {{this.status}}
{{/each}}

System Health:
- CPU Usage: {{cpu_usage}}%
- Memory Usage: {{memory_usage}}%
- Error Rate: {{error_rate}}%

Automated Actions:
{{#each automated_actions}}
- {{this.action}}: {{this.status}}
{{/each}}

Next Steps:
{{#each next_steps}}
1. {{this}}
{{/each}}

Dashboard: {{dashboard_url}}
Runbook: {{runbook_url}}
      `
    }
  }
}; 