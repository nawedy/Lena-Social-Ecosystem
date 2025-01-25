import { Request, Response, NextFunction } from 'express';

import { query } from '../db';

export async function validateBetaAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check if user is an active beta user
    const { rows } = await query(
      'SELECT status FROM beta_users WHERE did = $1',
      [req.user.did]
    );

    if (rows.length === 0 || rows[0].status !== 'active') {
      return res.status(403).json({
        error: 'Beta access required',
        message: 'You need to be an active beta user to access this feature',
      });
    }

    // Update last active timestamp
    await query(
      'UPDATE beta_users SET last_active_at = CURRENT_TIMESTAMP WHERE did = $1',
      [req.user.did]
    );

    next();
  } catch (error) {
    console.error('Error validating beta access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function trackBetaAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const startTime = process.hrtime();

    // Continue with the request
    res.on('finish', async () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      // Track the API call
      await query(
        `INSERT INTO beta_analytics 
        (user_id, event_type, event_data)
        VALUES ($1, $2, $3)`,
        [
          req.user.did,
          'api_call',
          {
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            duration,
            userAgent: req.headers['user-agent'],
          },
        ]
      ).catch(error => {
        console.error('Error tracking beta analytics:', error);
      });
    });

    next();
  } catch (error) {
    // Don't block the request if analytics tracking fails
    console.error('Error in beta analytics middleware:', error);
    next();
  }
}
