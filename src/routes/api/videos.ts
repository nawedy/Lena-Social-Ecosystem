import express from 'express';
import { body } from 'express-validator';

import {
  uploadVideo,
  getVideoById,
  getFeedVideos,
  likeVideo,
  unlikeVideo,
  addComment,
  deleteComment,
  getComments,
} from '../../controllers/videos';
import { requireAuth } from '../../middleware/requireAuth';
import { upload } from '../../middleware/upload';
import { validateRequest } from '../../middleware/validateRequest';

const router = express.Router();

// Video upload validation
const videoValidation = [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('description').optional().trim(),
  body('visibility')
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Invalid visibility option'),
];

// Comment validation
const commentValidation = [
  body('content').trim().isLength({ min: 1 }).withMessage('Comment cannot be empty'),
];

// Video routes
router.post(
  '/',
  requireAuth,
  upload.single('video'),
  videoValidation,
  validateRequest,
  uploadVideo
);
router.get('/feed', getFeedVideos);
router.get('/:id', getVideoById);
router.post('/:id/like', requireAuth, likeVideo);
router.delete('/:id/like', requireAuth, unlikeVideo);
router.get('/:id/comments', getComments);
router.post('/:id/comments', requireAuth, commentValidation, validateRequest, addComment);
router.delete('/:id/comments/:commentId', requireAuth, deleteComment);

export default router;
