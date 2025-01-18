import express from 'express';
import { getMetrics } from '../monitoring/BetaMetrics';

const router = express.Router();

// Metrics endpoint for Prometheus scraping
router.get('/metrics', async (req, res) => {
  try {
    // Basic auth check for metrics endpoint
    const auth = req.headers.authorization;
    if (!auth || !checkMetricsAuth(auth)) {
      res.set('WWW-Authenticate', 'Basic realm="Metrics"');
      return res.status(401).send('Authentication required');
    }

    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

// Simple auth check for metrics endpoint
function checkMetricsAuth(auth: string): boolean {
  // Basic auth format: "Basic base64(username:password)"
  const [scheme, credentials] = auth.split(' ');
  if (scheme !== 'Basic') return false;

  const decoded = Buffer.from(credentials, 'base64').toString();
  const [username, password] = decoded.split(':');

  return (
    username === process.env.METRICS_USERNAME &&
    password === process.env.METRICS_PASSWORD
  );
}

export default router;
