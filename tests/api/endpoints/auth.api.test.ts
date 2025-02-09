import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { api } from '../utils/api-client';
import { generateTestUser, cleanupTestUser } from '../utils/test-helpers';
import { validateAuthResponse } from '../utils/validators';

describe('Authentication API', () => {
  const testUser = generateTestUser();
  let authToken: string;

  beforeAll(async () => {
    await cleanupTestUser(testUser.email);
  });

  afterAll(async () => {
    await cleanupTestUser(testUser.email);
  });

  describe('Registration', () => {
    test('should register a new user successfully', async () => {
      const response = await api.post('/auth/register', {
        email: testUser.email,
        password: testUser.password,
        username: testUser.username
      });

      expect(response.status).toBe(201);
      expect(validateAuthResponse(response.data)).toBe(true);
      expect(response.data.user.email).toBe(testUser.email);
      expect(response.data.token).toBeDefined();
    });

    test('should fail to register with existing email', async () => {
      const response = await api.post('/auth/register', {
        email: testUser.email,
        password: 'different_password',
        username: 'different_username'
      }).catch(err => err.response);

      expect(response.status).toBe(409);
      expect(response.data.error).toBe('Email already registered');
    });

    test('should validate password requirements', async () => {
      const response = await api.post('/auth/register', {
        email: 'new@example.com',
        password: 'weak',
        username: 'newuser'
      }).catch(err => err.response);

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Password requirements not met');
    });
  });

  describe('Login', () => {
    test('should login successfully with correct credentials', async () => {
      const response = await api.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(response.status).toBe(200);
      expect(validateAuthResponse(response.data)).toBe(true);
      authToken = response.data.token;
    });

    test('should fail with incorrect password', async () => {
      const response = await api.post('/auth/login', {
        email: testUser.email,
        password: 'wrong_password'
      }).catch(err => err.response);

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Invalid credentials');
    });

    test('should fail with non-existent email', async () => {
      const response = await api.post('/auth/login', {
        email: 'nonexistent@example.com',
        password: 'any_password'
      }).catch(err => err.response);

      expect(response.status).toBe(401);
      expect(response.data.error).toBe('Invalid credentials');
    });
  });

  describe('Password Reset', () => {
    test('should send password reset email', async () => {
      const response = await api.post('/auth/forgot-password', {
        email: testUser.email
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toContain('Password reset email sent');
    });

    test('should reset password with valid token', async () => {
      // Get reset token from test helpers
      const resetToken = await api.post('/test/generate-reset-token', {
        email: testUser.email
      });

      const response = await api.post('/auth/reset-password', {
        token: resetToken.data.token,
        newPassword: 'NewPassword123!'
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toContain('Password reset successful');
    });

    test('should fail with invalid reset token', async () => {
      const response = await api.post('/auth/reset-password', {
        token: 'invalid_token',
        newPassword: 'NewPassword123!'
      }).catch(err => err.response);

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Invalid or expired reset token');
    });
  });

  describe('Token Management', () => {
    test('should refresh access token', async () => {
      const response = await api.post('/auth/refresh-token', {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.token).toBeDefined();
      expect(response.data.token).not.toBe(authToken);
    });

    test('should invalidate refresh token on logout', async () => {
      const logoutResponse = await api.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(logoutResponse.status).toBe(200);

      const refreshResponse = await api.post('/auth/refresh-token', {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      }).catch(err => err.response);

      expect(refreshResponse.status).toBe(401);
    });
  });

  describe('Multi-factor Authentication', () => {
    test('should enable 2FA', async () => {
      const response = await api.post('/auth/2fa/enable', {}, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.secret).toBeDefined();
      expect(response.data.qrCode).toBeDefined();
    });

    test('should verify 2FA setup', async () => {
      // Get test TOTP code from helpers
      const { code } = await api.post('/test/generate-2fa-code', {
        email: testUser.email
      });

      const response = await api.post('/auth/2fa/verify', {
        code
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.verified).toBe(true);
    });

    test('should require 2FA code on login when enabled', async () => {
      const loginResponse = await api.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.requires2FA).toBe(true);
      expect(loginResponse.data.token).toBeUndefined();

      // Get test TOTP code from helpers
      const { code } = await api.post('/test/generate-2fa-code', {
        email: testUser.email
      });

      const verifyResponse = await api.post('/auth/2fa/login', {
        email: testUser.email,
        code
      });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.data.token).toBeDefined();
    });
  });

  describe('Session Management', () => {
    test('should list active sessions', async () => {
      const response = await api.get('/auth/sessions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.sessions)).toBe(true);
      expect(response.data.sessions.length).toBeGreaterThan(0);
    });

    test('should terminate specific session', async () => {
      const sessions = await api.get('/auth/sessions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const sessionId = sessions.data.sessions[0].id;
      const response = await api.delete(`/auth/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toContain('Session terminated');
    });

    test('should terminate all other sessions', async () => {
      const response = await api.delete('/auth/sessions/all-except-current', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toContain('All other sessions terminated');

      const sessions = await api.get('/auth/sessions', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      expect(sessions.data.sessions.length).toBe(1);
    });
  });
}); 