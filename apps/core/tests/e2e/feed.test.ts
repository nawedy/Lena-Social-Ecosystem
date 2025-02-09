import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Feed Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/feed');
  });

  test('should load feed items', async ({ page }) => {
    await expect(page.locator('[data-testid="feed-item"]')).toHaveCount(10);
  });

  test('should load more items on scroll', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="feed-item"]').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000); // Wait for load

    const newCount = await page.locator('[data-testid="feed-item"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should filter feed by category', async ({ page }) => {
    await page.click('[data-testid="filter-dropdown"]');
    await page.click('[data-testid="filter-option-photos"]');

    await expect(page.locator('[data-testid="feed-item-type-photo"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="feed-item-type-video"]')).toHaveCount(0);
  });

  test('should sort feed items', async ({ page }) => {
    await page.click('[data-testid="sort-dropdown"]');
    await page.click('[data-testid="sort-option-recent"]');

    // Check dates are in descending order
    const dates = await page.$$eval('[data-testid="feed-item-date"]', 
      elements => elements.map(el => new Date(el.textContent).getTime())
    );
    
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  test('should like feed items', async ({ page }) => {
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    const likeButton = firstItem.locator('[data-testid="like-button"]');
    const likeCount = firstItem.locator('[data-testid="like-count"]');

    const initialCount = await likeCount.innerText();
    await likeButton.click();
    
    await expect(likeButton).toHaveClass(/active/);
    await expect(likeCount).toHaveText(`${parseInt(initialCount) + 1}`);
  });

  test('should comment on feed items', async ({ page }) => {
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    await firstItem.locator('[data-testid="comment-button"]').click();

    await page.fill('[data-testid="comment-input"]', 'Test comment');
    await page.click('[data-testid="submit-comment"]');

    await expect(page.locator('[data-testid="comment-text"]').last()).toHaveText('Test comment');
  });

  test('should share feed items', async ({ page }) => {
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    await firstItem.locator('[data-testid="share-button"]').click();

    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-options"]')).toContainText(['Copy Link', 'Twitter', 'Facebook']);
  });

  test('should save feed items', async ({ page }) => {
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    const saveButton = firstItem.locator('[data-testid="save-button"]');

    await saveButton.click();
    await expect(saveButton).toHaveClass(/active/);

    // Check saved items page
    await page.click('[data-testid="saved-items"]');
    await expect(page.locator('[data-testid="feed-item"]')).toHaveCount(1);
  });

  test('should report inappropriate content', async ({ page }) => {
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    await firstItem.locator('[data-testid="more-options"]').click();
    await page.click('[data-testid="report-option"]');

    await page.fill('[data-testid="report-reason"]', 'Inappropriate content');
    await page.click('[data-testid="submit-report"]');

    await expect(page.locator('[data-testid="report-success"]')).toBeVisible();
  });

  test('should handle media loading errors', async ({ page }) => {
    // Simulate failed image/video loading
    await page.route('**/*.{png,jpg,jpeg,webp,mp4}', route => route.abort());

    await page.reload();

    await expect(page.locator('[data-testid="media-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="media-fallback"]')).toBeVisible();
  });

  test('should handle offline mode', async ({ page }) => {
    // Enable offline mode
    await page.context().setOffline(true);

    // Try to interact
    const firstItem = page.locator('[data-testid="feed-item"]').first();
    await firstItem.locator('[data-testid="like-button"]').click();

    await expect(page.locator('[data-testid="offline-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-actions"]')).toBeVisible();

    // Re-enable online mode
    await page.context().setOffline(false);
    await expect(page.locator('[data-testid="offline-warning"]')).not.toBeVisible();
  });

  test('should optimize feed performance', async ({ page }) => {
    // Check image lazy loading
    const images = await page.$$('[data-testid="feed-image"]');
    for (const image of images) {
      await expect(image).toHaveAttribute('loading', 'lazy');
    }

    // Check video autoplay behavior
    const videos = await page.$$('[data-testid="feed-video"]');
    for (const video of videos) {
      await expect(video).toHaveAttribute('preload', 'none');
      await expect(video).not.toHaveAttribute('autoplay');
    }
  });
}); 