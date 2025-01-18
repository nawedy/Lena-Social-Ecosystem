import { Router } from 'express';

import { MetricsService } from '../services/MetricsService';

const router = Router();

// Metrics endpoint for Prometheus scraping
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await MetricsService.getInstance().getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

export default router;
