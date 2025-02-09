import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/search');
  });

  test('should display search interface', async ({ page }) => {
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-categories"]')).toBeVisible();
  });

  test('should perform basic search', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-result-item"]')).toHaveCount(10);
  });

  test('should filter search results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.click('[data-testid="filter-dropdown"]');
    await page.click('[data-testid="filter-option-videos"]');
    
    await expect(page.locator('[data-testid="search-result-video"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="search-result-photo"]')).toHaveCount(0);
  });

  test('should sort search results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.click('[data-testid="sort-dropdown"]');
    await page.click('[data-testid="sort-option-recent"]');
    
    // Check dates are in descending order
    const dates = await page.$$eval('[data-testid="result-date"]', 
      elements => elements.map(el => new Date(el.textContent).getTime())
    );
    
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  test('should handle advanced search options', async ({ page }) => {
    await page.click('[data-testid="advanced-search"]');
    
    // Set advanced filters
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-03-01');
    await page.selectOption('[data-testid="content-type"]', 'video');
    await page.selectOption('[data-testid="duration"]', '5-10min');
    
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.click('[data-testid="search-submit"]');
    
    await expect(page.locator('[data-testid="search-result-item"]')).toHaveCount(5);
    await expect(page.locator('[data-testid="active-filters"]')).toContainText(['Date Range', 'Video', '5-10min']);
  });

  test('should handle search suggestions', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'te');
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-item"]')).toHaveCount(5);
    
    // Click suggestion
    await page.click('[data-testid="suggestion-item"]');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should handle empty search results', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'nonexistentquery123456789');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggested-queries"]')).toBeVisible();
  });

  test('should handle search history', async ({ page }) => {
    // Perform searches
    const searches = ['query1', 'query2', 'query3'];
    for (const query of searches) {
      await page.fill('[data-testid="search-input"]', query);
      await page.press('[data-testid="search-input"]', 'Enter');
    }
    
    // Check history
    await page.click('[data-testid="search-history"]');
    for (const query of searches.reverse()) {
      await expect(page.locator('[data-testid="history-item"]')).toContainText(query);
    }
    
    // Clear history
    await page.click('[data-testid="clear-history"]');
    await expect(page.locator('[data-testid="history-item"]')).toHaveCount(0);
  });

  test('should handle search analytics', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Click result
    await page.click('[data-testid="search-result-item"]');
    
    // Check analytics modal
    await page.click('[data-testid="search-analytics"]');
    await expect(page.locator('[data-testid="search-metrics"]')).toContainText(['Searches', 'Clicks', 'CTR']);
  });

  test('should handle search performance', async ({ page }) => {
    // Test search debouncing
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="search-input"]', `rapid query ${i}`);
    }
    
    // Should only see one network request
    const requests = await page.evaluate(() => 
      performance.getEntriesByType('resource')
        .filter(entry => entry.name.includes('/api/search'))
    );
    expect(requests.length).toBe(1);
  });

  test('should handle search errors', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/search', route => route.abort('failed'));
    
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    await expect(page.locator('[data-testid="search-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-search"]')).toBeVisible();
  });

  test('should optimize search result loading', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'test query');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Check lazy loading of images
    const resultImages = await page.$$('[data-testid="result-image"]');
    for (const image of resultImages) {
      await expect(image).toHaveAttribute('loading', 'lazy');
    }
    
    // Check infinite scroll
    const initialCount = await page.locator('[data-testid="search-result-item"]').count();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const newCount = await page.locator('[data-testid="search-result-item"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });
}); 