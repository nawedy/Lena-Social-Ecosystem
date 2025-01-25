import express from 'express';
import { body } from 'express-validator';

import {
  getNotifications,
  markNotificationRead,
  shareVideo,
  reportContent,
} from '../../controllers/social';
import { requireAuth } from '../../middleware/requireAuth';
import { validateRequest } from '../../middleware/validateRequest';

const router = express.Router();

// Report validation
const reportValidation = [
  body('reason')
    .isIn(['spam', 'inappropriate', 'copyright', 'other'])
    .withMessage('Invalid report reason'),
  body('description').optional().trim(),
];

// Share validation
const shareValidation = [
  body('platform')
    .isIn(['internal', 'whatsapp', 'telegram', 'twitter'])
    .withMessage('Invalid platform'),
];

// Social routes
router.get('/notifications', requireAuth, getNotifications);
router.put('/notifications/:id', requireAuth, markNotificationRead);
router.post(
  '/share/:videoId',
  requireAuth,
  shareValidation,
  validateRequest,
  shareVideo
);
router.post(
  '/report',
  requireAuth,
  reportValidation,
  validateRequest,
  reportContent
);

export default router;
