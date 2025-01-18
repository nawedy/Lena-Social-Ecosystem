import express from 'express';

import { query, transaction } from '../db';
import { authenticateUser } from '../middleware/auth';
import { validateBetaAccess } from '../middleware/beta';
import { rateLimit } from '../middleware/rateLimit';

const router = express.Router();

// Beta status endpoint
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM beta_users WHERE did = $1', [req.user.did]);

    const betaUserCount = await query('SELECT COUNT(*) FROM beta_users WHERE status = $1', [
      'active',
    ]);

    res.json({
      isBetaUser: rows.length > 0 && rows[0].status === 'active',
      betaUserCount: parseInt(betaUserCount.rows[0].count),
    });
  } catch (error) {
    console.error('Error checking beta status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit feedback
router.post(
  '/feedback',
  authenticateUser,
  validateBetaAccess,
  rateLimit({ windowMs: 60000, max: 5 }),
  async (req, res) => {
    const { type, title, description, priority, rating, metadata } = req.body;

    try {
      const { rows } = await query(
        `INSERT INTO beta_feedback 
        (user_id, type, title, description, priority, rating, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [req.user.did, type, title, description, priority, rating, metadata]
      );

      // Track analytics
      await query(
        `INSERT INTO beta_analytics 
        (user_id, event_type, event_data)
        VALUES ($1, $2, $3)`,
        [req.user.did, 'feedback_submitted', { feedbackId: rows[0].id }]
      );

      res.json({ id: rows[0].id });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Request beta access
router.post('/request-access', authenticateUser, async (req, res) => {
  const { invitationCode } = req.body;

  try {
    await transaction(async (client) => {
      // Check if user already has beta access
      const existingUser = await client.query('SELECT * FROM beta_users WHERE did = $1', [
        req.user.did,
      ]);

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already has beta access' });
      }

      // Verify invitation code if provided
      if (invitationCode) {
        const inviter = await client.query('SELECT * FROM beta_users WHERE invitation_code = $1', [
          invitationCode,
        ]);

        if (inviter.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid invitation code' });
        }
      }

      // Check beta user limit
      const betaUserCount = await client.query(
        'SELECT COUNT(*) FROM beta_users WHERE status = $1',
        ['active']
      );

      if (parseInt(betaUserCount.rows[0].count) >= 1000) {
        return res.status(403).json({ error: 'Beta testing limit reached' });
      }

      // Create beta user
      const { rows } = await client.query(
        `INSERT INTO beta_users 
        (did, handle, invited_by, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [req.user.did, req.user.handle, invitationCode ? invitationCode : null, 'active']
      );

      // Generate new invitation code for the user
      const newInvitationCode = generateInvitationCode();
      await client.query('UPDATE beta_users SET invitation_code = $1 WHERE did = $2', [
        newInvitationCode,
        req.user.did,
      ]);

      res.json({
        status: 'active',
        invitationCode: newInvitationCode,
      });
    });
  } catch (error) {
    console.error('Error requesting beta access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get feature flags
router.get('/features', authenticateUser, validateBetaAccess, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT f.name, f.enabled, uf.enabled as user_enabled
        FROM beta_feature_flags f
        LEFT JOIN beta_user_features uf 
        ON f.id = uf.feature_id AND uf.user_id = $1
        WHERE f.enabled = true`,
      [req.user.did]
    );

    const features = rows.reduce((acc, row) => {
      acc[row.name] = row.user_enabled ?? row.enabled;
      return acc;
    }, {});

    res.json({ features });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function generateInvitationCode(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default router;
