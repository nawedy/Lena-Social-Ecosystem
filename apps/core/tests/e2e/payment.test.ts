import { test, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

test.describe('Payment Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'Password123!');
    await page.click('[data-testid="login-submit"]');
    await page.goto('/payments');
  });

  test('should display payment interface', async ({ page }) => {
    await expect(page.locator('[data-testid="payment-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-methods"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-status"]')).toBeVisible();
  });

  test('should add credit card payment method', async ({ page }) => {
    await page.click('[data-testid="add-payment-method"]');
    await page.click('[data-testid="credit-card-option"]');
    
    // Fill card details
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.fill('[data-testid="card-name"]', 'Test User');
    
    await page.click('[data-testid="save-card"]');
    
    // Verify card was added
    await expect(page.locator('[data-testid="payment-method-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-last4"]')).toHaveText('4242');
  });

  test('should add crypto payment method', async ({ page }) => {
    await page.click('[data-testid="add-payment-method"]');
    await page.click('[data-testid="crypto-option"]');
    
    // Connect wallet
    await page.click('[data-testid="connect-wallet"]');
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    
    // Verify wallet was added
    await expect(page.locator('[data-testid="payment-method-crypto"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-address"]')).not.toBeEmpty();
  });

  test('should handle subscription purchase', async ({ page }) => {
    await page.click('[data-testid="subscription-plans"]');
    await page.click('[data-testid="select-pro-plan"]');
    
    // Select payment method
    await page.click('[data-testid="select-payment-method"]');
    await page.click('[data-testid="use-card-4242"]');
    
    // Confirm subscription
    await page.click('[data-testid="confirm-subscription"]');
    
    // Verify subscription status
    await expect(page.locator('[data-testid="subscription-active"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-type"]')).toHaveText('Pro');
  });

  test('should handle one-time purchase', async ({ page }) => {
    await page.click('[data-testid="store"]');
    await page.click('[data-testid="product-item"]');
    
    // Add to cart
    await page.click('[data-testid="add-to-cart"]');
    await page.click('[data-testid="checkout"]');
    
    // Select payment method
    await page.click('[data-testid="select-payment-method"]');
    await page.click('[data-testid="use-card-4242"]');
    
    // Complete purchase
    await page.click('[data-testid="complete-purchase"]');
    
    // Verify purchase success
    await expect(page.locator('[data-testid="purchase-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-number"]')).not.toBeEmpty();
  });

  test('should handle payment method management', async ({ page }) => {
    // Set default payment method
    await page.click('[data-testid="payment-method-options"]');
    await page.click('[data-testid="set-default-4242"]');
    
    await expect(page.locator('[data-testid="default-payment-method"]')).toContainText('4242');
    
    // Remove payment method
    await page.click('[data-testid="payment-method-options"]');
    await page.click('[data-testid="remove-payment-method"]');
    await page.click('[data-testid="confirm-remove"]');
    
    await expect(page.locator('[data-testid="payment-method-card"]')).not.toBeVisible();
  });

  test('should handle billing history', async ({ page }) => {
    await page.click('[data-testid="billing-history-tab"]');
    
    // Check invoice details
    await expect(page.locator('[data-testid="invoice-item"]')).toHaveCount(5);
    
    // Download invoice
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-invoice"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/invoice-\d+\.pdf/);
  });

  test('should handle subscription management', async ({ page }) => {
    await page.click('[data-testid="subscription-settings"]');
    
    // Cancel subscription
    await page.click('[data-testid="cancel-subscription"]');
    await page.fill('[data-testid="cancellation-reason"]', 'Too expensive');
    await page.click('[data-testid="confirm-cancellation"]');
    
    // Verify cancellation
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText('Cancelled');
    await expect(page.locator('[data-testid="reactivate-subscription"]')).toBeVisible();
  });

  test('should handle payment errors', async ({ page }) => {
    await page.click('[data-testid="add-payment-method"]');
    await page.click('[data-testid="credit-card-option"]');
    
    // Test invalid card
    await page.fill('[data-testid="card-number"]', '4242424242424241');
    await page.fill('[data-testid="card-expiry"]', '12/25');
    await page.fill('[data-testid="card-cvc"]', '123');
    await page.click('[data-testid="save-card"]');
    
    await expect(page.locator('[data-testid="card-error"]')).toBeVisible();
  });

  test('should handle refund requests', async ({ page }) => {
    await page.click('[data-testid="billing-history-tab"]');
    await page.click('[data-testid="invoice-item"]');
    await page.click('[data-testid="request-refund"]');
    
    // Fill refund form
    await page.fill('[data-testid="refund-reason"]', 'Product not as described');
    await page.click('[data-testid="submit-refund"]');
    
    // Verify refund request
    await expect(page.locator('[data-testid="refund-pending"]')).toBeVisible();
  });

  test('should handle payment analytics', async ({ page }) => {
    await page.click('[data-testid="payment-analytics"]');
    
    // Check payment metrics
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="one-time-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="refund-rate"]')).toBeVisible();
    
    // Check revenue chart
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
  });

  test('should handle payment settings', async ({ page }) => {
    await page.click('[data-testid="payment-settings"]');
    
    // Update currency preference
    await page.selectOption('[data-testid="currency-preference"]', 'EUR');
    await page.click('[data-testid="save-preferences"]');
    
    // Verify currency update
    await expect(page.locator('[data-testid="currency-display"]')).toContainText('€');
  });

  test('should optimize payment performance', async ({ page }) => {
    // Check payment form caching
    await page.click('[data-testid="add-payment-method"]');
    await page.click('[data-testid="credit-card-option"]');
    
    // Fill form first time
    await page.fill('[data-testid="card-number"]', '4242424242424242');
    await page.goBack();
    
    // Check if form is pre-filled on return
    await page.click('[data-testid="add-payment-method"]');
    await page.click('[data-testid="credit-card-option"]');
    
    const cardNumber = await page.inputValue('[data-testid="card-number"]');
    expect(cardNumber).toBe('4242424242424242');
  });
}); 