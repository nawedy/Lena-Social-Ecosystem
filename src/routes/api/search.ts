import express from 'express';
import { query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import {
  searchUsers,
  searchVideos,
  searchHashtags,
  getTrendingHashtags,
  getPopularCategories,
} from '../../controllers/search';

const router = express.Router();

// Search validation
const searchValidation = [
  query('q')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query is required'),
  query('type')
    .optional()
    .isIn(['users', 'videos', 'hashtags'])
    .withMessage('Invalid search type'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

// Search routes
router.get('/', searchValidation, validateRequest, searchUsers);
router.get('/videos', searchValidation, validateRequest, searchVideos);
router.get('/hashtags', searchValidation, validateRequest, searchHashtags);
router.get('/trending/hashtags', getTrendingHashtags);
router.get('/categories/popular', getPopularCategories);

export default router;
