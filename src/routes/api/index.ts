import express from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import videoRoutes from './videos';
import socialRoutes from './social';
import searchRoutes from './search';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/videos', videoRoutes);
router.use('/social', socialRoutes);
router.use('/search', searchRoutes);

export default router;
