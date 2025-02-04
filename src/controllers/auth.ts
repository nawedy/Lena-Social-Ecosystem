import bcrypt from 'bcrypt';
import { Request, Response, NextFunction, query as ExpressQuery } from 'express';
import { validationResult } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { config } from '../config';
import { initializeDatabase, query } from '../db';
import { sendEmail } from '../services/email';
import { logger } from '../utils/logger';

if (!config.jwt.secret || !config.jwt.refreshSecret || !config.tokenExpiration) {
    throw new Error('JWT secrets, refresh secrets and token expiration time must be defined');
}

const generateToken = (userId: number, secret: string, expiresIn: string) => {  
  if (!secret || secret.trim() === '') {
    throw new Error('JWT secrets must be defined');
}
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
    const token = generateToken(userId, config.jwt.secret, '1h');
    const refreshToken = generateToken(userId, config.jwt.refreshSecret, '7d');

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

    const token = generateToken(user.id, config.jwt.secret, '1h');
    const refreshToken = generateToken(user.id, config.jwt.refreshSecret, '7d');

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

    const decoded = jwt.verify(reqRefreshToken, config.jwt.refreshSecret) as JwtPayload;  const token = generateToken(decoded.userId as number, config.jwt.secret, '1h');
    const newRefreshToken = generateToken(
      decoded.userId,
      config.jwt.refreshSecret,
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

    // Check if the user exists
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }
    const userId = userResult.rows[0].id;
    // Generate a unique token
    const token = uuidv4();
    // Store the token in the database along with the email and an expiration time
    const expirationTime = new Date(Date.now() + (config.tokenExpiration * 1000));
    await query(
      'INSERT INTO passwordResetTokens (token, email, createdAt) VALUES ($1, $2, $3)',
      [token, email, expirationTime]
    );

    // Send the password reset email
    const resetLink = `http://localhost:3000/reset-password/${token}`; // Adjust with the correct URL
    // Use a fake email sender for now
    await sendEmail(
      email,
      'Password Reset',
      `Please click the following link to reset your password: ${resetLink}\nThis link will expire in one hour.`
    );

    logger.info(`Password reset requested for user ${email}, token: ${token}`);
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
      
      // Retrieve the token from the database
      const tokenResult = await query(
        'SELECT * FROM passwordResetTokens WHERE token = $1',
        [token]
      );
      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      const tokenData = tokenResult.rows[0];
      const tokenExpirationTime = new Date(tokenData.createdAt);
      
      // Check if the token has expired
      if (tokenExpirationTime.getTime() < Date.now()) {
        // Remove the expired token from the database
        await query('DELETE FROM passwordResetTokens WHERE token = $1', [token]);
        return res.status(400).json({ message: 'Token has expired' });
      }
      const email = tokenData.email
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user's password in the database
      await query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, email]
      );

      // Remove the token from the database
      await query('DELETE FROM passwordResetTokens WHERE token = $1', [token]);

      logger.info(`Password reset successfully with token ${token}`);
      res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error resetting password', error);
    next(error);
  }
};

