import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

import { initializeDatabase, query } from '../db';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';
const REFRESH_JWT_SECRET =
  process.env.REFRESH_JWT_SECRET || 'your-default-refresh-secret';

const generateToken = (userId: number, secret: string, expiresIn: string) => {
  return jwt.sign({ userId }, secret, { expiresIn });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const db = await initializeDatabase();
    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const result = await query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashedPassword]
    );

    const userId = result.rows[0].id;
    const token = generateToken(userId, JWT_SECRET, '1h');
    const refreshToken = generateToken(userId, REFRESH_JWT_SECRET, '7d');

    res.status(201).json({ token, refreshToken });
    logger.info(`User ${username} registered successfully`);
  } catch (error) {
    logger.error(`Error registering user`, error);
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id, JWT_SECRET, '1h');
    const refreshToken = generateToken(user.id, REFRESH_JWT_SECRET, '7d');

    res.json({ token, refreshToken });
    logger.info(`User ${email} logged in successfully`);
  } catch (error) {
    logger.error(`Error logging in user`, error);
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Error logging out', error);
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken: reqRefreshToken } = req.body;
    if (!reqRefreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(reqRefreshToken, REFRESH_JWT_SECRET) as {
      userId: number;
    };
    const token = generateToken(decoded.userId, JWT_SECRET, '1h');
    const newRefreshToken = generateToken(
      decoded.userId,
      REFRESH_JWT_SECRET,
      '7d'
    );

    res.json({ token, refreshToken: newRefreshToken });
    logger.info(`Token refreshed successfully for user ${decoded.userId}`);
  } catch (error) {
    logger.error(`Error refreshing token`, error);
    res.status(403).json({ message: 'Invalid refresh token' });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    // TODO: Implement logic for generating and sending a password reset token
    logger.info(`Password reset requested for user ${email}`);
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    logger.error('Error handling forgot password request', error);
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    // TODO: Implement logic for resetting the password using the token
    logger.info(`Password reset initiated with token ${token}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error resetting password', error);
    next(error);
  }
};
