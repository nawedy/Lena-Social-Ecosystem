import { test, expect } from '@playwright/test';
import { setup, teardown, getPage, getAgent } from './setup';
import { BskyAgent } from '@atproto/api';
import { privacyCompliance } from '../../src/services/privacyCompliance';
import { mlContentModeration } from '../../src/services/mlContentModeration';
import { conflictResolution } from '../../src/services/conflictResolution';
import { offlineSync } from '../../src/services/offlineSync';

let page: any;
let agent: BskyAgent;

test.beforeAll(async () => {
  await setup();
  page = getPage();
  agent = getAgent();
});

test.afterAll(async () => {
  await teardown();
});

test.describe('TikTokToe E2E Tests', () => {
  test.describe('Authentication & User Management', () => {
    test('should successfully sign up a new user', async () => {
      await page.goto('/signup');
      await page.fill('[data-testid="username-input"]', 'testuser');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.click('[data-testid="signup-button"]');

      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    });

    test('should handle invalid login attempts', async () => {
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', 'wronguser');
      await page.fill('[data-testid="password-input"]', 'wrongpass');
      await page.click('[data-testid="login-button"]');

      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Content Creation & Interaction', () => {
    test('should create and publish a post', async () => {
      await page.goto('/compose');
      await page.fill('[data-testid="post-content"]', 'Test post content');
      await page.click('[data-testid="publish-button"]');

      await expect(page.locator('[data-testid="post-success"]')).toBeVisible();
      const post = await page.locator('[data-testid="post-content"]').first();
      await expect(post).toContainText('Test post content');
    });

    test('should handle media uploads', async () => {
      await page.goto('/compose');
      await page.setInputFiles(
        '[data-testid="media-input"]',
        'tests/fixtures/test-image.jpg'
      );
      await page.fill('[data-testid="post-content"]', 'Post with media');
      await page.click('[data-testid="publish-button"]');

      await expect(page.locator('[data-testid="media-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="post-success"]')).toBeVisible();
    });
  });

  test.describe('Privacy & Compliance', () => {
    test('should handle CCPA data export request', async () => {
      const userId = 'test-user-id';
      const result = await privacyCompliance.requestDataExport(userId);

      expect(result.type).toBe('export');
      expect(result.status).toBe('pending');

      // Wait for export to complete
      await page.waitForTimeout(5000);
      const updatedResult = await privacyCompliance.getDataRequest(result.id);
      expect(updatedResult.status).toBe('completed');
    });

    test('should handle data deletion request', async () => {
      const userId = 'test-user-id';
      const result = await privacyCompliance.requestDataDeletion(userId);

      expect(result.type).toBe('deletion');
      expect(result.status).toBe('pending');

      // Wait for deletion to complete
      await page.waitForTimeout(5000);
      const updatedResult = await privacyCompliance.getDataRequest(result.id);
      expect(updatedResult.status).toBe('completed');
    });
  });

  test.describe('Content Moderation', () => {
    test('should detect inappropriate content in text', async () => {
      const text = 'This is inappropriate content for testing';
      const result = await mlContentModeration.analyzeText(text, 'test-uri');

      expect(result.contentType).toBe('text');
      expect(result.scores).toBeDefined();
      expect(result.moderationDecision).toBeDefined();
    });

    test('should detect inappropriate content in images', async () => {
      const imageUrl = 'tests/fixtures/test-image.jpg';
      const result = await mlContentModeration.analyzeImage(
        imageUrl,
        'test-uri'
      );

      expect(result.contentType).toBe('image');
      expect(result.scores).toBeDefined();
      expect(result.labels).toBeDefined();
    });
  });

  test.describe('Offline Support & Sync', () => {
    test('should handle offline post creation', async () => {
      // Simulate offline state
      await page.setOfflineMode(true);

      const result = await offlineSync.createOfflinePost('Offline test post');
      expect(result).toBeDefined();

      // Verify post is stored locally
      const pendingPosts = await offlineSync.getPendingPosts();
      expect(pendingPosts).toContainEqual(
        expect.objectContaining({
          text: 'Offline test post',
        })
      );

      // Restore online state and verify sync
      await page.setOfflineMode(false);
      await page.waitForTimeout(5000);

      const syncedPosts = await offlineSync.getPendingPosts();
      expect(syncedPosts).toHaveLength(0);
    });

    test('should handle conflict resolution', async () => {
      const localVersion = { text: 'Local version' };
      const remoteVersion = { text: 'Remote version' };

      const hasConflict = await conflictResolution.detectConflicts(
        localVersion,
        remoteVersion,
        'post'
      );

      expect(hasConflict).toBe(true);

      // Resolve conflict
      await conflictResolution.resolveConflict('test-conflict-id');

      const resolvedConflict =
        await conflictResolution.getConflictDetails('test-conflict-id');
      expect(resolvedConflict.status).toBe('resolved');
    });
  });

  test.describe('Performance & Error Handling', () => {
    test('should handle network latency', async () => {
      // Simulate slow network
      await page.route('**/*', route => route.continue({ delay: 1000 }));

      const startTime = Date.now();
      await page.goto('/feed');
      const loadTime = Date.now() - startTime;

      // Verify loading state is shown
      await expect(
        page.locator('[data-testid="loading-indicator"]')
      ).toBeVisible();

      // Verify page loads within acceptable time
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle server errors gracefully', async () => {
      // Simulate server error
      await page.route('**/api/**', route =>
        route.fulfill({
          status: 500,
          body: 'Server error',
        })
      );

      await page.goto('/feed');

      // Verify error state is shown
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      // Verify retry button is available
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });
  });

  test.describe('Security Features', () => {
    test('should prevent XSS attacks', async () => {
      const maliciousContent = '<script>alert("xss")</script>';
      await page.goto('/compose');
      await page.fill('[data-testid="post-content"]', maliciousContent);
      await page.click('[data-testid="publish-button"]');

      const post = await page.locator('[data-testid="post-content"]').first();
      await expect(post).not.toContainText(maliciousContent);
      await expect(post.evaluate(el => el.innerHTML)).not.toContain('<script>');
    });

    test('should enforce rate limiting', async () => {
      // Attempt rapid-fire requests
      const requests = Array(10)
        .fill(null)
        .map(() => page.goto('/api/endpoint'));

      const results = await Promise.allSettled(requests);
      const tooManyRequests = results.filter(
        r => r.status === 'fulfilled' && r.value.status() === 429
      );

      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should meet WCAG guidelines', async () => {
      await page.goto('/');
      const violations = await page.evaluate(() => {
        // Run axe-core
        return window.axe.run();
      });

      expect(violations.violations).toHaveLength(0);
    });

    test('should support keyboard navigation', async () => {
      await page.goto('/');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid')
      );

      expect(focusedElement).toBeDefined();
    });
  });
});

// Helper functions for test data management
async function createTestPost(content: string) {
  return agent.post({
    text: content,
    createdAt: new Date().toISOString(),
  });
}

async function cleanupTestPost(uri: string) {
  return agent.deletePost(uri);
}
