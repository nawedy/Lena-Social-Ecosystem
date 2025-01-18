import express from 'express';

import authRoutes from './auth';
import searchRoutes from './search';
import socialRoutes from './social';
import userRoutes from './users';
import videoRoutes from './videos';

const router = express.Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/videos', videoRoutes);
router.use('/social', socialRoutes);
router.use('/search', searchRoutes);

export default router;
