import { Page, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

// Authentication helpers
export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL);
  await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL('/feed');
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout"]');
  await expect(page).toHaveURL('/login');
}

// Navigation helpers
export async function navigateTo(page: Page, route: string) {
  await page.goto(`/${route}`);
  await expect(page).toHaveURL(`/${route}`);
}

// Data generation helpers
export function generateRandomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

export function generateRandomEmail(): string {
  return `test.${generateRandomString()}@example.com`;
}

export function generateRandomUsername(): string {
  return `user_${generateRandomString()}`;
}

// Mock data helpers
export async function createMockPost(userId: string) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      title: `Test Post ${generateRandomString()}`,
      content: 'Test content',
      type: 'text',
      status: 'published'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createMockComment(userId: string, postId: number) {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      post_id: postId,
      content: `Test comment ${generateRandomString()}`
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// UI interaction helpers
export async function waitForLoadingToComplete(page: Page) {
  await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
}

export async function fillForm(page: Page, formData: Record<string, string>) {
  for (const [field, value] of Object.entries(formData)) {
    await page.fill(`[data-testid="${field}"]`, value);
  }
}

export async function submitForm(page: Page, submitButtonTestId: string = 'form-submit') {
  await page.click(`[data-testid="${submitButtonTestId}"]`);
}

// File upload helpers
export async function uploadFile(page: Page, filePath: string, inputTestId: string) {
  const input = page.locator(`[data-testid="${inputTestId}"]`);
  await input.setInputFiles(filePath);
}

// Modal interaction helpers
export async function closeModal(page: Page) {
  await page.click('[data-testid="modal-close"]');
  await expect(page.locator('[data-testid="modal"]')).not.toBeVisible();
}

// Error handling helpers
export async function expectErrorMessage(page: Page, message: string) {
  await expect(page.locator('[data-testid="error-message"]')).toContainText(message);
}

export async function expectSuccessMessage(page: Page, message: string) {
  await expect(page.locator('[data-testid="success-message"]')).toContainText(message);
}

// Notification helpers
export async function expectNotification(page: Page, message: string) {
  await expect(page.locator('[data-testid="notification"]')).toContainText(message);
}

// Payment helpers
export async function fillCardDetails(page: Page, cardData = {
  number: '4242424242424242',
  expiry: '12/25',
  cvc: '123',
  name: 'Test User'
}) {
  await page.fill('[data-testid="card-number"]', cardData.number);
  await page.fill('[data-testid="card-expiry"]', cardData.expiry);
  await page.fill('[data-testid="card-cvc"]', cardData.cvc);
  await page.fill('[data-testid="card-name"]', cardData.name);
}

// Analytics helpers
export async function expectMetricValue(page: Page, metricTestId: string, expectedValue: string | number) {
  await expect(page.locator(`[data-testid="${metricTestId}-value"]`)).toHaveText(expectedValue.toString());
}

// Date helpers
export function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

// Responsive testing helpers
export async function setViewportSize(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
}

export const viewportSizes = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
};

// Network condition helpers
export async function simulateOffline(page: Page) {
  await page.context().setOffline(true);
}

export async function simulateOnline(page: Page) {
  await page.context().setOffline(false);
}

// Performance helpers
export async function measurePageLoad(page: Page, url: string) {
  const startTime = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return Date.now() - startTime;
}

// Cleanup helpers
export async function cleanupTestData(userId: string) {
  const tables = [
    'transactions',
    'subscriptions',
    'payment_methods',
    'analytics_events',
    'comments',
    'likes',
    'shares',
    'posts',
    'notifications',
    'user_settings'
  ];

  for (const table of tables) {
    await supabase
      .from(table)
      .delete()
      .eq('user_id', userId);
  }
}

// State verification helpers
export async function verifyLoggedInState(page: Page) {
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
}

export async function verifyLoggedOutState(page: Page) {
  await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
}

// SEO helpers
export async function verifySEOTags(page: Page, expectedTags: Record<string, string>) {
  for (const [tag, value] of Object.entries(expectedTags)) {
    await expect(page.locator(`meta[name="${tag}"]`)).toHaveAttribute('content', value);
  }
}

// Accessibility helpers
export async function verifyAccessibility(page: Page) {
  // This would integrate with axe-core or similar accessibility testing tools
  // Implementation would depend on the specific accessibility testing library chosen
}

// Security helpers
export async function verifyCSRFToken(page: Page) {
  await expect(page.locator('meta[name="csrf-token"]')).toBeVisible();
}

export async function verifySecureHeaders(response) {
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-xss-protection']).toBe('1; mode=block');
}

// Export common test data
export const testData = {
  user: {
    email: 'test@example.com',
    password: 'Password123!',
    username: 'testuser',
    fullName: 'Test User'
  },
  post: {
    title: 'Test Post',
    content: 'Test content',
    type: 'text'
  },
  comment: {
    content: 'Test comment'
  },
  payment: {
    amount: 1000,
    currency: 'usd'
  }
}; 