import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Analytics Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/analytics');
  });

  test('should display analytics dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="analytics-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="analytics-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="analytics-charts"]')).toBeVisible();
  });

  test('should display key metrics', async ({ page }) => {
    // Check all key metrics are displayed
    const metrics = [
      'total-views',
      'total-likes',
      'total-comments',
      'total-shares',
      'engagement-rate',
      'average-watch-time'
    ];
    
    for (const metric of metrics) {
      await expect(page.locator(`[data-testid="${metric}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${metric}-value"]`)).not.toBeEmpty();
    }
  });

  test('should handle date range selection', async ({ page }) => {
    // Test different date ranges
    const ranges = ['7d', '30d', '90d', 'ytd', 'all'];
    
    for (const range of ranges) {
      await page.click(`[data-testid="date-range-${range}"]`);
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="analytics-data"]')).toBeVisible();
    }
    
    // Test custom date range
    await page.click('[data-testid="date-range-custom"]');
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-03-01');
    await page.click('[data-testid="apply-date-range"]');
    
    await expect(page.locator('[data-testid="analytics-data"]')).toBeVisible();
  });

  test('should display audience demographics', async ({ page }) => {
    await page.click('[data-testid="tab-audience"]');
    
    // Check demographic charts
    await expect(page.locator('[data-testid="age-distribution"]')).toBeVisible();
    await expect(page.locator('[data-testid="gender-distribution"]')).toBeVisible();
    await expect(page.locator('[data-testid="location-distribution"]')).toBeVisible();
    await expect(page.locator('[data-testid="device-distribution"]')).toBeVisible();
  });

  test('should display content performance', async ({ page }) => {
    await page.click('[data-testid="tab-content"]');
    
    // Check content performance metrics
    await expect(page.locator('[data-testid="top-posts"]')).toBeVisible();
    await expect(page.locator('[data-testid="post-performance"]')).toBeVisible();
    await expect(page.locator('[data-testid="content-trends"]')).toBeVisible();
  });

  test('should handle data export', async ({ page }) => {
    await page.click('[data-testid="export-data"]');
    
    // Select export options
    await page.click('[data-testid="export-views"]');
    await page.click('[data-testid="export-engagement"]');
    await page.click('[data-testid="export-audience"]');
    
    // Export data
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="start-export"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/analytics-export-\d+\.csv/);
  });

  test('should handle data visualization options', async ({ page }) => {
    // Test different chart types
    const chartTypes = ['line', 'bar', 'pie'];
    
    for (const type of chartTypes) {
      await page.click(`[data-testid="chart-type-${type}"]`);
      await expect(page.locator(`[data-testid="chart-${type}"]`)).toBeVisible();
    }
    
    // Test data grouping
    const groupings = ['daily', 'weekly', 'monthly'];
    
    for (const group of groupings) {
      await page.click(`[data-testid="group-by-${group}"]`);
      await expect(page.locator('[data-testid="chart-data"]')).toBeVisible();
    }
  });

  test('should handle real-time analytics', async ({ page }) => {
    await page.click('[data-testid="tab-realtime"]');
    
    // Check real-time metrics
    await expect(page.locator('[data-testid="active-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="current-views"]')).toBeVisible();
    await expect(page.locator('[data-testid="live-engagement"]')).toBeVisible();
    
    // Simulate real-time update
    await page.evaluate(() => {
      window.postMessage({
        type: 'ANALYTICS_UPDATE',
        data: {
          activeUsers: 150,
          currentViews: 300,
          engagement: 75
        }
      }, '*');
    });
    
    await expect(page.locator('[data-testid="active-users-value"]')).toHaveText('150');
  });

  test('should handle comparison analytics', async ({ page }) => {
    await page.click('[data-testid="enable-comparison"]');
    
    // Set comparison date range
    await page.fill('[data-testid="comparison-date-from"]', '2024-01-01');
    await page.fill('[data-testid="comparison-date-to"]', '2024-01-31');
    await page.click('[data-testid="apply-comparison"]');
    
    // Check comparison metrics
    await expect(page.locator('[data-testid="comparison-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="metrics-difference"]')).toBeVisible();
    await expect(page.locator('[data-testid="trend-indicator"]')).toBeVisible();
  });

  test('should handle analytics filters', async ({ page }) => {
    // Apply content filters
    await page.click('[data-testid="filter-button"]');
    await page.selectOption('[data-testid="content-type"]', 'video');
    await page.selectOption('[data-testid="content-category"]', 'music');
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered data
    await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-filters"]')).toContainText(['Video', 'Music']);
  });

  test('should handle analytics errors', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/analytics/**', route => route.abort('failed'));
    await page.reload();
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Test retry functionality
    await page.unroute('**/api/analytics/**');
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="analytics-data"]')).toBeVisible();
  });

  test('should optimize analytics performance', async ({ page }) => {
    // Check data caching
    await page.click('[data-testid="date-range-7d"]');
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
    
    // Second click should use cached data
    await page.click('[data-testid="date-range-30d"]');
    await page.click('[data-testid="date-range-7d"]');
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
    
    // Check lazy loading of charts
    const charts = await page.$$('[data-testid="analytics-chart"]');
    for (const chart of charts) {
      await expect(chart).toHaveAttribute('loading', 'lazy');
    }
  });
}); 