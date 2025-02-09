import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Profile Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/profile');
  });

  test('should display user profile information', async ({ page }) => {
    await expect(page.locator('[data-testid="profile-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-bio"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-avatar"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-stats"]')).toBeVisible();
  });

  test('should edit profile information', async ({ page }) => {
    await page.click('[data-testid="edit-profile-button"]');
    
    // Update profile info
    await page.fill('[data-testid="edit-username"]', 'newUsername');
    await page.fill('[data-testid="edit-bio"]', 'New bio text');
    
    // Upload new avatar
    const avatarInput = page.locator('[data-testid="avatar-upload"]');
    await avatarInput.setInputFiles('test-assets/avatar.jpg');
    
    await page.click('[data-testid="save-profile"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="profile-username"]')).toHaveText('newUsername');
    await expect(page.locator('[data-testid="profile-bio"]')).toHaveText('New bio text');
  });

  test('should manage privacy settings', async ({ page }) => {
    await page.click('[data-testid="privacy-settings"]');
    
    // Toggle privacy options
    await page.click('[data-testid="private-profile-toggle"]');
    await page.click('[data-testid="hide-activity-toggle"]');
    
    await page.reload();
    
    // Verify settings persisted
    await page.click('[data-testid="privacy-settings"]');
    await expect(page.locator('[data-testid="private-profile-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="hide-activity-toggle"]')).toBeChecked();
  });

  test('should display profile activity', async ({ page }) => {
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-item"]')).toHaveCount(10);
    
    // Test activity filters
    await page.click('[data-testid="activity-filter-posts"]');
    await expect(page.locator('[data-testid="activity-item-post"]')).toHaveCount(5);
  });

  test('should manage followers and following', async ({ page }) => {
    await page.click('[data-testid="followers-count"]');
    await expect(page.locator('[data-testid="followers-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="follower-item"]')).toHaveCount(5);
    
    await page.click('[data-testid="following-count"]');
    await expect(page.locator('[data-testid="following-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="following-item"]')).toHaveCount(5);
    
    // Test unfollow
    const firstFollowing = page.locator('[data-testid="following-item"]').first();
    await firstFollowing.locator('[data-testid="unfollow-button"]').click();
    await expect(page.locator('[data-testid="following-item"]')).toHaveCount(4);
  });

  test('should manage saved items', async ({ page }) => {
    await page.click('[data-testid="saved-items-tab"]');
    await expect(page.locator('[data-testid="saved-item"]')).toHaveCount(5);
    
    // Test removing saved item
    const firstSaved = page.locator('[data-testid="saved-item"]').first();
    await firstSaved.locator('[data-testid="unsave-button"]').click();
    await expect(page.locator('[data-testid="saved-item"]')).toHaveCount(4);
  });

  test('should handle profile verification', async ({ page }) => {
    await page.click('[data-testid="verify-profile-button"]');
    
    // Fill verification form
    await page.fill('[data-testid="verification-full-name"]', 'John Doe');
    await page.setInputFiles('[data-testid="verification-document"]', 'test-assets/document.jpg');
    await page.click('[data-testid="submit-verification"]');
    
    await expect(page.locator('[data-testid="verification-pending"]')).toBeVisible();
  });

  test('should manage notification preferences', async ({ page }) => {
    await page.click('[data-testid="notification-settings"]');
    
    // Toggle notification options
    await page.click('[data-testid="email-notifications-toggle"]');
    await page.click('[data-testid="push-notifications-toggle"]');
    
    await page.reload();
    
    // Verify settings persisted
    await page.click('[data-testid="notification-settings"]');
    await expect(page.locator('[data-testid="email-notifications-toggle"]')).toBeChecked();
    await expect(page.locator('[data-testid="push-notifications-toggle"]')).toBeChecked();
  });

  test('should handle profile deletion', async ({ page }) => {
    await page.click('[data-testid="account-settings"]');
    await page.click('[data-testid="delete-account"]');
    
    // Confirm deletion
    await page.fill('[data-testid="delete-confirmation"]', 'DELETE');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page).toHaveURL('/login');
    
    // Verify cannot login with deleted account
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Account not found');
  });

  test('should handle rate limiting', async ({ page }) => {
    // Attempt rapid profile updates
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="edit-profile-button"]');
      await page.fill('[data-testid="edit-username"]', `username${i}`);
      await page.click('[data-testid="save-profile"]');
    }
    
    await expect(page.locator('[data-testid="rate-limit-warning"]')).toBeVisible();
  });

  test('should optimize profile image loading', async ({ page }) => {
    // Check avatar image optimization
    const avatar = page.locator('[data-testid="profile-avatar"]');
    await expect(avatar).toHaveAttribute('loading', 'eager');
    await expect(avatar).toHaveAttribute('srcset');
    
    // Check gallery image optimization
    const galleryImages = await page.$$('[data-testid="gallery-image"]');
    for (const image of galleryImages) {
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('srcset');
    }
  });
}); 