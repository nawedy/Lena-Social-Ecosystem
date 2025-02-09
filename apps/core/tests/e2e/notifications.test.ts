import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Notifications Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/notifications');
  });

  test('should display notifications interface', async ({ page }) => {
    await expect(page.locator('[data-testid="notifications-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="notifications-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="notifications-list"]')).toBeVisible();
  });

  test('should display different notification types', async ({ page }) => {
    // Check all notification types
    const notificationTypes = ['likes', 'comments', 'follows', 'mentions', 'system'];
    
    for (const type of notificationTypes) {
      await page.click(`[data-testid="tab-${type}"]`);
      await expect(page.locator(`[data-testid="notification-${type}"]`)).toHaveCount(5);
    }
  });

  test('should mark notifications as read', async ({ page }) => {
    // Get unread notification
    const unreadNotification = page.locator('[data-testid="notification-unread"]').first();
    await unreadNotification.click();
    
    // Verify notification is marked as read
    await expect(unreadNotification).toHaveClass(/read/);
    
    // Check unread count decreased
    const newUnreadCount = await page.locator('[data-testid="unread-count"]').innerText();
    expect(parseInt(newUnreadCount)).toBeLessThan(5);
  });

  test('should mark all notifications as read', async ({ page }) => {
    await page.click('[data-testid="mark-all-read"]');
    
    // Verify all notifications are marked as read
    await expect(page.locator('[data-testid="notification-unread"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="unread-count"]')).toHaveText('0');
  });

  test('should delete notifications', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="notification-item"]').count();
    
    // Delete first notification
    await page.hover('[data-testid="notification-item"]');
    await page.click('[data-testid="delete-notification"]');
    
    // Verify notification is deleted
    const newCount = await page.locator('[data-testid="notification-item"]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should clear all notifications', async ({ page }) => {
    await page.click('[data-testid="clear-all"]');
    
    // Confirm clear all
    await page.click('[data-testid="confirm-clear-all"]');
    
    // Verify all notifications are cleared
    await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
  });

  test('should handle notification actions', async ({ page }) => {
    // Like notification
    const likeNotification = page.locator('[data-testid="notification-likes"]').first();
    await likeNotification.click();
    
    // Verify redirected to content
    await expect(page).toHaveURL(/\/post\/\d+/);
    
    // Comment notification
    await page.goto('/notifications');
    const commentNotification = page.locator('[data-testid="notification-comments"]').first();
    await commentNotification.click();
    
    // Verify redirected to comment
    await expect(page).toHaveURL(/\/post\/\d+#comment-\d+/);
  });

  test('should handle notification preferences', async ({ page }) => {
    await page.click('[data-testid="notification-settings"]');
    
    // Toggle notification preferences
    const preferences = [
      'email-likes',
      'email-comments',
      'email-follows',
      'push-likes',
      'push-comments',
      'push-follows'
    ];
    
    for (const pref of preferences) {
      await page.click(`[data-testid="${pref}-toggle"]`);
      await expect(page.locator(`[data-testid="${pref}-toggle"]`)).toBeChecked();
    }
    
    // Save preferences
    await page.click('[data-testid="save-preferences"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should handle real-time notifications', async ({ page }) => {
    // Listen for new notifications
    const newNotificationPromise = page.waitForSelector('[data-testid="notification-new"]');
    
    // Simulate new notification (this would typically come from your backend)
    await page.evaluate(() => {
      window.postMessage({
        type: 'NEW_NOTIFICATION',
        data: {
          type: 'like',
          content: 'Someone liked your post'
        }
      }, '*');
    });
    
    // Verify new notification appears
    await newNotificationPromise;
    await expect(page.locator('[data-testid="notification-new"]')).toBeVisible();
  });

  test('should handle notification filters', async ({ page }) => {
    await page.click('[data-testid="filter-button"]');
    
    // Apply date filter
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-03-01');
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered notifications
    const dates = await page.$$eval('[data-testid="notification-date"]',
      elements => elements.map(el => new Date(el.textContent).getTime())
    );
    
    const startDate = new Date('2024-01-01').getTime();
    const endDate = new Date('2024-03-01').getTime();
    
    dates.forEach(date => {
      expect(date).toBeGreaterThanOrEqual(startDate);
      expect(date).toBeLessThanOrEqual(endDate);
    });
  });

  test('should handle notification search', async ({ page }) => {
    await page.fill('[data-testid="search-notifications"]', 'liked your post');
    
    // Verify search results
    await expect(page.locator('[data-testid="notification-item"]')).toContainText('liked your post');
  });

  test('should handle notification errors', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/notifications', route => route.abort('failed'));
    await page.reload();
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Test retry functionality
    await page.unroute('**/api/notifications');
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="notification-item"]')).toBeVisible();
  });

  test('should optimize notification loading', async ({ page }) => {
    // Check infinite scroll
    const initialCount = await page.locator('[data-testid="notification-item"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const newCount = await page.locator('[data-testid="notification-item"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
    
    // Check lazy loading of notification images
    const images = await page.$$('[data-testid="notification-image"]');
    for (const image of images) {
      await expect(image).toHaveAttribute('loading', 'lazy');
    }
  });
}); 