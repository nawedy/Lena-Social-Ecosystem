import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow user to sign up with email', async ({ page }) => {
    await page.click('[data-testid="signup-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="signup-submit"]');

    await expect(page).toHaveURL('/onboarding');
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('should allow user to sign in with email', async ({ page }) => {
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL('/feed');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'wrong@example.com');
    await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
    await page.click('[data-testid="login-submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });

  test('should allow password reset', async ({ page }) => {
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="forgot-password"]');
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.click('[data-testid="reset-submit"]');

    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Check your email');
  });

  test('should allow OAuth sign in', async ({ page }) => {
    await page.click('[data-testid="login-button"]');
    await page.click('[data-testid="google-signin"]');

    // Handle OAuth popup
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('[data-testid="google-signin"]')
    ]);

    await popup.waitForLoadState();
    await expect(popup.url()).toContain('accounts.google.com');
  });

  test('should allow user to sign out', async ({ page }) => {
    // Sign in first
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');

    // Then sign out
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="signout-button"]');

    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
  });

  test('should enforce password requirements', async ({ page }) => {
    await page.click('[data-testid="signup-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'weak');
    await page.click('[data-testid="signup-submit"]');

    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.route('**/*', route => route.abort());

    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
  });

  test('should maintain session state', async ({ page }) => {
    // Sign in
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');

    // Refresh page
    await page.reload();

    // Should still be signed in
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/login?redirect=/settings');
  });

  test('should redirect back to protected route after login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/login?redirect=/settings');

    await page.fill('[data-testid="email-input"]', 'existing@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL('/settings');
  });
}); 