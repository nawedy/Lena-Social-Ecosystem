import { test, expect } from '@playwright/test';
import { login, createContent, interactWithContent, checkAnalytics } from '../utils/test-helpers';

test.describe('Critical Path Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('user authentication flow', async ({ page }) => {
    // Test registration
    await test.step('registration', async () => {
      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'Test123!@#');
      await page.click('[data-testid="submit-button"]');
      await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
    });

    // Test login
    await test.step('login', async () => {
      await login(page, 'test@example.com', 'Test123!@#');
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    // Test logout
    await test.step('logout', async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });
  });

  test('content creation and interaction flow', async ({ page }) => {
    await login(page, 'test@example.com', 'Test123!@#');

    // Create content
    await test.step('content creation', async () => {
      const content = {
        title: 'Test Content',
        description: 'Test Description',
        type: 'video'
      };
      const contentId = await createContent(page, content);
      expect(contentId).toBeTruthy();
    });

    // Interact with content
    await test.step('content interaction', async () => {
      const interactions = await interactWithContent(page, 'latest-content');
      expect(interactions.likes).toBeGreaterThan(0);
      expect(interactions.comments).toBeGreaterThan(0);
    });

    // Check analytics
    await test.step('analytics verification', async () => {
      const analytics = await checkAnalytics(page, 'latest-content');
      expect(analytics.views).toBeGreaterThan(0);
      expect(analytics.engagement).toBeGreaterThan(0);
    });
  });

  test('payment and subscription flow', async ({ page }) => {
    await login(page, 'test@example.com', 'Test123!@#');

    // Subscribe to premium
    await test.step('subscription', async () => {
      await page.click('[data-testid="upgrade-button"]');
      await page.click('[data-testid="premium-plan"]');
      
      // Fill payment details
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');
      
      await page.click('[data-testid="subscribe-button"]');
      await expect(page.locator('[data-testid="premium-badge"]')).toBeVisible();
    });

    // Verify premium features
    await test.step('premium features', async () => {
      await page.goto('/premium-content');
      await expect(page.locator('[data-testid="premium-content"]')).toBeVisible();
      
      await page.goto('/analytics');
      await expect(page.locator('[data-testid="advanced-analytics"]')).toBeVisible();
    });
  });

  test('social interaction flow', async ({ page }) => {
    await login(page, 'test@example.com', 'Test123!@#');

    // Follow users
    await test.step('follow users', async () => {
      await page.goto('/discover');
      await page.click('[data-testid="follow-button"]');
      await expect(page.locator('[data-testid="following-badge"]')).toBeVisible();
    });

    // Create and interact with comments
    await test.step('commenting', async () => {
      await page.goto('/latest-content');
      await page.fill('[data-testid="comment-input"]', 'Great content!');
      await page.click('[data-testid="submit-comment"]');
      await expect(page.locator('[data-testid="comment-success"]')).toBeVisible();
    });

    // Check notifications
    await test.step('notifications', async () => {
      await page.click('[data-testid="notifications-button"]');
      await expect(page.locator('[data-testid="notification-item"]')).toBeVisible();
    });
  });

  test('search and discovery flow', async ({ page }) => {
    await login(page, 'test@example.com', 'Test123!@#');

    // Search functionality
    await test.step('search', async () => {
      await page.fill('[data-testid="search-input"]', 'test content');
      await page.press('[data-testid="search-input"]', 'Enter');
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    });

    // Content discovery
    await test.step('discovery', async () => {
      await page.goto('/discover');
      await expect(page.locator('[data-testid="trending-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommended-content"]')).toBeVisible();
    });

    // Category navigation
    await test.step('categories', async () => {
      await page.click('[data-testid="categories-menu"]');
      await page.click('[data-testid="category-item"]');
      await expect(page.locator('[data-testid="category-content"]')).toBeVisible();
    });
  });
});

test.afterEach(async ({ page }) => {
  // Cleanup test data
  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (authToken) {
    // Call cleanup API
    await fetch(`${process.env.API_URL}/test/cleanup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  }
}); 