import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Settings Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/settings');
  });

  test('should display settings interface', async ({ page }) => {
    await expect(page.locator('[data-testid="settings-nav"]')).toBeVisible();
    await expect(page.locator('[data-testid="settings-content"]')).toBeVisible();
    
    // Check all settings sections are available
    const sections = ['Account', 'Privacy', 'Notifications', 'Security', 'Appearance', 'Language', 'Accessibility'];
    for (const section of sections) {
      await expect(page.locator(`[data-testid="settings-section-${section.toLowerCase()}"]`)).toBeVisible();
    }
  });

  test('should update account settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-account"]');
    
    // Update email
    await page.click('[data-testid="change-email"]');
    await page.fill('[data-testid="new-email"]', 'newemail@example.com');
    await page.fill('[data-testid="current-password"]', 'Password123!');
    await page.click('[data-testid="save-email"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Update username
    await page.click('[data-testid="change-username"]');
    await page.fill('[data-testid="new-username"]', 'newusername');
    await page.click('[data-testid="save-username"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should update privacy settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-privacy"]');
    
    // Toggle privacy options
    const privacyToggles = [
      'profile-visibility',
      'activity-visibility',
      'search-visibility',
      'message-privacy'
    ];
    
    for (const toggle of privacyToggles) {
      await page.click(`[data-testid="${toggle}-toggle"]`);
      await expect(page.locator(`[data-testid="${toggle}-toggle"]`)).toBeChecked();
    }
    
    // Verify settings persist after reload
    await page.reload();
    for (const toggle of privacyToggles) {
      await expect(page.locator(`[data-testid="${toggle}-toggle"]`)).toBeChecked();
    }
  });

  test('should update notification settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-notifications"]');
    
    // Configure notification preferences
    const notificationTypes = [
      'email-notifications',
      'push-notifications',
      'in-app-notifications'
    ];
    
    for (const type of notificationTypes) {
      await page.click(`[data-testid="${type}-toggle"]`);
      await expect(page.locator(`[data-testid="${type}-toggle"]`)).toBeChecked();
    }
    
    // Set quiet hours
    await page.fill('[data-testid="quiet-hours-start"]', '22:00');
    await page.fill('[data-testid="quiet-hours-end"]', '07:00');
    await page.click('[data-testid="save-quiet-hours"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should update security settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-security"]');
    
    // Change password
    await page.click('[data-testid="change-password"]');
    await page.fill('[data-testid="current-password"]', 'Password123!');
    await page.fill('[data-testid="new-password"]', 'NewPassword123!');
    await page.fill('[data-testid="confirm-password"]', 'NewPassword123!');
    await page.click('[data-testid="save-password"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    
    // Enable 2FA
    await page.click('[data-testid="enable-2fa"]');
    await expect(page.locator('[data-testid="2fa-qr-code"]')).toBeVisible();
    await page.fill('[data-testid="2fa-code"]', '123456');
    await page.click('[data-testid="confirm-2fa"]');
    
    await expect(page.locator('[data-testid="2fa-enabled"]')).toBeVisible();
  });

  test('should update appearance settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-appearance"]');
    
    // Change theme
    await page.click('[data-testid="theme-dark"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    
    await page.click('[data-testid="theme-light"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    
    // Change font size
    await page.selectOption('[data-testid="font-size"]', 'large');
    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
  });

  test('should update language settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-language"]');
    
    // Change language
    await page.selectOption('[data-testid="language-select"]', 'es');
    await expect(page.locator('[data-testid="confirm-language-modal"]')).toBeVisible();
    await page.click('[data-testid="confirm-language"]');
    
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('[data-testid="settings-title"]')).toHaveText('Configuración');
  });

  test('should update accessibility settings', async ({ page }) => {
    await page.click('[data-testid="settings-section-accessibility"]');
    
    // Toggle accessibility options
    const accessibilityToggles = [
      'high-contrast',
      'reduce-motion',
      'screen-reader-optimization'
    ];
    
    for (const toggle of accessibilityToggles) {
      await page.click(`[data-testid="${toggle}-toggle"]`);
      await expect(page.locator(`[data-testid="${toggle}-toggle"]`)).toBeChecked();
    }
    
    // Verify settings are applied
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
  });

  test('should handle data export', async ({ page }) => {
    await page.click('[data-testid="settings-section-account"]');
    await page.click('[data-testid="export-data"]');
    
    // Select data to export
    await page.click('[data-testid="export-profile"]');
    await page.click('[data-testid="export-posts"]');
    await page.click('[data-testid="export-activity"]');
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="start-export"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/data-export-\d+\.zip/);
  });

  test('should handle account deletion', async ({ page }) => {
    await page.click('[data-testid="settings-section-account"]');
    await page.click('[data-testid="delete-account"]');
    
    // Confirm deletion
    await page.fill('[data-testid="delete-confirmation"]', 'DELETE');
    await page.fill('[data-testid="password-confirmation"]', 'Password123!');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page).toHaveURL('/login');
    
    // Verify account is deleted
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Account not found');
  });

  test('should handle settings validation', async ({ page }) => {
    await page.click('[data-testid="settings-section-account"]');
    
    // Test invalid email
    await page.click('[data-testid="change-email"]');
    await page.fill('[data-testid="new-email"]', 'invalid-email');
    await page.click('[data-testid="save-email"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    
    // Test weak password
    await page.click('[data-testid="change-password"]');
    await page.fill('[data-testid="new-password"]', 'weak');
    await page.click('[data-testid="save-password"]');
    
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should handle settings errors', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/settings/**', route => route.abort('failed'));
    
    await page.click('[data-testid="settings-section-account"]');
    await page.click('[data-testid="change-username"]');
    await page.fill('[data-testid="new-username"]', 'newusername');
    await page.click('[data-testid="save-username"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});