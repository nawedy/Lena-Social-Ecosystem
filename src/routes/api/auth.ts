import express from 'express';
import { body } from 'express-validator';

import * as AuthController from '../../controllers/auth';
import { requireAuth } from '../../middleware/requireAuth';
import { validateRequest } from '../../middleware/validateRequest';

const router = express.Router();

// Registration validation
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Must be a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
];

// Login validation
const loginValidation = [
  body('email').isEmail().withMessage('Must be a valid email'),
  body('password').exists().withMessage('Password is required'),
];

// Auth routes
router.post(
  '/register',
  registerValidation,
  validateRequest,
  AuthController.register
);
router.post('/login', loginValidation, validateRequest, AuthController.login);
router.post('/logout', requireAuth, AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);
router.post(
  '/forgot-password',
  body('email').isEmail(),
  validateRequest,
  AuthController.forgotPassword
);
router.post(
  '/reset-password/:token',
  body('password').isLength({ min: 8 }),
  validateRequest,
  AuthController.resetPassword
);

export default router;
