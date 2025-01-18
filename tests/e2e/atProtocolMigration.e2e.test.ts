import { test, expect } from '@playwright/test';

test.describe('TikTok to TikTokToe Migration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(process.env.APP_URL!);
    // Login
    await page.fill(
      '[data-testid="username-input"]',
      process.env.TEST_USERNAME!
    );
    await page.fill(
      '[data-testid="password-input"]',
      process.env.TEST_PASSWORD!
    );
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  });

  test('should successfully migrate TikTok account', async ({ page }) => {
    // Navigate to migration page
    await page.click('[data-testid="migration-button"]');
    await page.waitForSelector('[data-testid="migration-wizard"]');

    // Enter TikTok username
    await page.fill(
      '[data-testid="tiktok-username-input"]',
      process.env.TIKTOK_TEST_USERNAME!
    );

    // Select migration options
    await page.check('[data-testid="import-videos-checkbox"]');
    await page.check('[data-testid="import-followers-checkbox"]');
    await page.check('[data-testid="import-analytics-checkbox"]');

    // Start migration
    await page.click('[data-testid="start-migration-button"]');

    // Wait for migration to complete
    await page.waitForSelector('[data-testid="migration-complete"]', {
      timeout: 60000,
    });

    // Verify migration results
    const videosImported = await page.textContent(
      '[data-testid="videos-imported"]'
    );
    expect(parseInt(videosImported!)).toBeGreaterThan(0);

    const followersImported = await page.textContent(
      '[data-testid="followers-imported"]'
    );
    expect(parseInt(followersImported!)).toBeGreaterThan(0);

    const analyticsImported = await page.isVisible(
      '[data-testid="analytics-imported"]'
    );
    expect(analyticsImported).toBe(true);
  });

  test('should handle migration errors gracefully', async ({ page }) => {
    await page.click('[data-testid="migration-button"]');
    await page.waitForSelector('[data-testid="migration-wizard"]');

    // Enter invalid TikTok username
    await page.fill(
      '[data-testid="tiktok-username-input"]',
      'nonexistent_user'
    );
    await page.click('[data-testid="start-migration-button"]');

    // Verify error message
    const errorMessage = await page.textContent(
      '[data-testid="error-message"]'
    );
    expect(errorMessage).toContain('User not found');

    // Verify retry button
    const retryButton = await page.isVisible('[data-testid="retry-button"]');
    expect(retryButton).toBe(true);
  });

  test('should persist migration progress across page reloads', async ({
    page,
  }) => {
    await page.click('[data-testid="migration-button"]');
    await page.waitForSelector('[data-testid="migration-wizard"]');

    // Start migration
    await page.fill(
      '[data-testid="tiktok-username-input"]',
      process.env.TIKTOK_TEST_USERNAME!
    );
    await page.click('[data-testid="start-migration-button"]');

    // Wait for progress indicator
    await page.waitForSelector('[data-testid="migration-progress"]');

    // Get current progress
    const initialProgress = await page.textContent(
      '[data-testid="progress-percentage"]'
    );

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="migration-progress"]');

    // Verify progress persisted
    const currentProgress = await page.textContent(
      '[data-testid="progress-percentage"]'
    );
    expect(parseInt(currentProgress!)).toBeGreaterThanOrEqual(
      parseInt(initialProgress!)
    );
  });

  // Add more E2E test cases...
});
