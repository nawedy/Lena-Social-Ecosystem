import { Counter, Gauge, Registry } from 'prom-client';
import express from 'express';
import basicAuth from 'express-basic-auth';

// Create a new registry
const register = new Registry();

// Beta tester metrics
const betaTesters = new Gauge({
  name: 'beta_testers_total',
  help: 'Total number of beta testers by status',
  labelNames: ['status'],
  registers: [register],
});

// Feature usage metrics
const featureUsage = new Counter({
  name: 'feature_usage_total',
  help: 'Number of times each feature is used',
  labelNames: ['feature'],
  registers: [register],
});

// Feedback metrics
const feedback = new Counter({
  name: 'feedback_total',
  help: 'Number of feedback submissions by type',
  labelNames: ['type'],
  registers: [register],
});

// Migration metrics
const migrationTotal = new Counter({
  name: 'migration_total',
  help: 'Total number of migration attempts',
  registers: [register],
});

const migrationSuccess = new Counter({
  name: 'migration_success_total',
  help: 'Total number of successful migrations',
  registers: [register],
});

// Error metrics
const errorTotal = new Counter({
  name: 'error_total',
  help: 'Total number of errors',
  registers: [register],
});

const requestTotal = new Counter({
  name: 'request_total',
  help: 'Total number of requests',
  registers: [register],
});

// Initialize some data
betaTesters.labels('active').set(50);
betaTesters.labels('invited').set(20);

// Simulate activity
setInterval(() => {
  // Simulate feature usage
  const features = [
    'create_post',
    'upload_video',
    'share_content',
    'edit_profile',
  ];
  const randomFeature = features[Math.floor(Math.random() * features.length)];
  featureUsage.labels(randomFeature).inc();
  requestTotal.inc();

  // Simulate some errors (5% error rate)
  if (Math.random() < 0.05) {
    errorTotal.inc();
  }

  // Simulate feedback
  if (Math.random() < 0.1) {
    const feedbackTypes = ['positive', 'negative', 'neutral'];
    const randomType =
      feedbackTypes[Math.floor(Math.random() * feedbackTypes.length)];
    feedback.labels(randomType).inc();
  }

  // Simulate migrations
  if (Math.random() < 0.05) {
    migrationTotal.inc();
    if (Math.random() < 0.95) {
      // 95% success rate
      migrationSuccess.inc();
    }
  }

  // Simulate beta tester churn (every 10 seconds)
  if (Math.random() < 0.1) {
    const activeValue = betaTesters.labels('active').get();
    const invitedValue = betaTesters.labels('invited').get();

    if (Math.random() < 0.7) {
      // 70% chance of gaining a tester
      betaTesters.labels('active').set(activeValue + 1);
      betaTesters.labels('invited').set(invitedValue - 1);
    } else {
      // 30% chance of losing a tester
      betaTesters.labels('active').set(activeValue - 1);
    }
  }
}, 1000);

// Create Express server
const app = express();

// Add basic authentication
const username = process.env.PROMETHEUS_USERNAME || 'prometheus';
const password =
  process.env.PROMETHEUS_PASSWORD || 'Xy7+dQ9K2N5vM4pR8sT3wU6hJ1mB4nL9kF3qE5zW';

app.use(
  basicAuth({
    users: { [username]: password },
    challenge: true,
  })
);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Start server
const port = process.env.METRICS_PORT || 3000;
app.listen(port, () => {
  logger.info(`Metrics server listening on port ${port}`);
});
