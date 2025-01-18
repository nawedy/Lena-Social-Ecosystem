import express from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../../middleware/requireAuth';
import { validateRequest } from '../../middleware/validateRequest';
import {
  getProfile,
  updateProfile,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getUserVideos,
} from '../../controllers/users';

const router = express.Router();

// Profile update validation
const profileValidation = [
  body('displayName').optional().trim(),
  body('bio').optional().trim(),
  body('profilePictureUrl')
    .optional()
    .isURL()
    .withMessage('Must be a valid URL'),
];

// User routes
router.get('/profile/:username', getProfile);
router.put(
  '/profile',
  requireAuth,
  profileValidation,
  validateRequest,
  updateProfile
);
router.post('/:id/follow', requireAuth, followUser);
router.delete('/:id/follow', requireAuth, unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);
router.get('/:id/videos', getUserVideos);

export default router;
