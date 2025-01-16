import client from 'prom-client';

// Create registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Beta Tester Metrics
export const betaTesterStatus = new client.Gauge({
  name: 'beta_tester_status',
  help: 'Current status of beta testers',
  labelNames: ['status'],
  registers: [register]
});

export const betaTesterActivations = new client.Counter({
  name: 'beta_tester_activations_total',
  help: 'Total number of beta tester activations',
  registers: [register]
});

// Feedback Metrics
export const feedbackSubmissions = new client.Counter({
  name: 'beta_feedback_created_total',
  help: 'Total number of feedback submissions',
  registers: [register]
});

export const feedbackByType = new client.Gauge({
  name: 'beta_feedback_total',
  help: 'Number of feedback items by type',
  labelNames: ['type'],
  registers: [register]
});

// Migration Metrics
export const migrationAttempts = new client.Counter({
  name: 'beta_migration_attempts_total',
  help: 'Total number of TikTok account migration attempts',
  registers: [register]
});

export const migrationSuccess = new client.Counter({
  name: 'beta_migration_success_total',
  help: 'Total number of successful TikTok account migrations',
  registers: [register]
});

export const migrationDuration = new client.Histogram({
  name: 'beta_migration_duration',
  help: 'Duration of TikTok account migrations',
  buckets: [1000, 5000, 10000, 20000, 30000, 60000], // buckets in milliseconds
  registers: [register]
});

// Feature Usage Metrics
export const featureUsage = new client.Counter({
  name: 'beta_feature_usage_total',
  help: 'Usage count of beta features',
  labelNames: ['feature'],
  registers: [register]
});

// Error Metrics
export const errorCount = new client.Counter({
  name: 'beta_errors_total',
  help: 'Count of errors during beta testing',
  labelNames: ['type', 'component'],
  registers: [register]
});

// Session Metrics
export const sessionDuration = new client.Histogram({
  name: 'beta_session_duration',
  help: 'Duration of beta tester sessions',
  buckets: [300, 600, 1800, 3600, 7200], // buckets in seconds
  registers: [register]
});

export const activeUsers = new client.Gauge({
  name: 'beta_active_users',
  help: 'Number of currently active beta users',
  registers: [register]
});

// Example usage functions
export const recordMigrationAttempt = async (durationMs: number, success: boolean) => {
  migrationAttempts.inc();
  if (success) {
    migrationSuccess.inc();
  }
  migrationDuration.observe(durationMs);
};

export const recordFeatureUsage = (feature: string) => {
  featureUsage.inc({ feature });
};

export const recordError = (type: string, component: string) => {
  errorCount.inc({ type, component });
};

export const updateBetaTesterStatus = (active: number, invited: number, inactive: number) => {
  betaTesterStatus.set({ status: 'active' }, active);
  betaTesterStatus.set({ status: 'invited' }, invited);
  betaTesterStatus.set({ status: 'inactive' }, inactive);
};

export const recordFeedback = (type: string) => {
  feedbackSubmissions.inc();
  feedbackByType.inc({ type });
};

export const startSession = () => {
  activeUsers.inc();
  return Date.now();
};

export const endSession = (startTime: number) => {
  activeUsers.dec();
  const durationSec = (Date.now() - startTime) / 1000;
  sessionDuration.observe(durationSec);
};

// Metrics endpoint handler
export const getMetrics = async () => {
  return register.metrics();
};

export default register;
