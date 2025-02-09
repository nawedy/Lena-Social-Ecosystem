import { test as base, expect } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';
import {
  loginAsTestUser,
  createMockPost,
  createMockComment,
  cleanupTestData,
  testData
} from './utils';

// Extend base test with custom fixtures
export const test = base.extend({
  // Authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    await loginAsTestUser(page);
    await use(page);
  },

  // Test user fixture
  testUser: async ({}, use) => {
    // Create test user
    const { data: user, error } = await supabase.auth.signUp({
      email: testData.user.email,
      password: testData.user.password,
      options: {
        data: {
          username: testData.user.username,
          full_name: testData.user.fullName
        }
      }
    });

    if (error) throw error;

    await use(user);

    // Cleanup test user
    await supabase.auth.admin.deleteUser(user.id);
  },

  // Test post fixture
  testPost: async ({ testUser }, use) => {
    const post = await createMockPost(testUser.id);
    await use(post);
    await supabase.from('posts').delete().eq('id', post.id);
  },

  // Test comment fixture
  testComment: async ({ testUser, testPost }, use) => {
    const comment = await createMockComment(testUser.id, testPost.id);
    await use(comment);
    await supabase.from('comments').delete().eq('id', comment.id);
  },

  // Test payment method fixture
  testPaymentMethod: async ({ testUser }, use) => {
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: testUser.id,
        type: 'card',
        last4: '4242',
        brand: 'visa',
        exp_month: 12,
        exp_year: 2025
      })
      .select()
      .single();

    if (error) throw error;

    await use(paymentMethod);
    await supabase.from('payment_methods').delete().eq('id', paymentMethod.id);
  },

  // Test subscription fixture
  testSubscription: async ({ testUser }, use) => {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: testUser.id,
        plan_id: 'pro',
        status: 'active',
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await use(subscription);
    await supabase.from('subscriptions').delete().eq('id', subscription.id);
  },

  // Test transaction fixture
  testTransaction: async ({ testUser }, use) => {
    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        user_id: testUser.id,
        amount: testData.payment.amount,
        currency: testData.payment.currency,
        status: 'completed',
        type: 'subscription'
      })
      .select()
      .single();

    if (error) throw error;

    await use(transaction);
    await supabase.from('transactions').delete().eq('id', transaction.id);
  },

  // Test notification fixture
  testNotification: async ({ testUser }, use) => {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: testUser.id,
        type: 'like',
        content: 'Someone liked your post',
        status: 'unread'
      })
      .select()
      .single();

    if (error) throw error;

    await use(notification);
    await supabase.from('notifications').delete().eq('id', notification.id);
  },

  // Test analytics fixture
  testAnalytics: async ({ testUser }, use) => {
    const { data: analytics, error } = await supabase
      .from('analytics_events')
      .insert({
        user_id: testUser.id,
        event_type: 'view',
        content_id: 1,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await use(analytics);
    await supabase.from('analytics_events').delete().eq('id', analytics.id);
  },

  // Test settings fixture
  testSettings: async ({ testUser }, use) => {
    const { data: settings, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: testUser.id,
        theme: 'light',
        language: 'en',
        notifications_enabled: true
      })
      .select()
      .single();

    if (error) throw error;

    await use(settings);
    await supabase.from('user_settings').delete().eq('id', settings.id);
  },

  // Storage fixture for file uploads
  testStorage: async ({ testUser }, use) => {
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const { data: upload, error } = await supabase.storage
      .from('test-bucket')
      .upload(`${testUser.id}/test.txt`, testFile);

    if (error) throw error;

    await use(upload);
    await supabase.storage.from('test-bucket').remove([`${testUser.id}/test.txt`]);
  }
});

// Export expect for convenience
export { expect };

// Export common test hooks
export const hooks = {
  // Before each test
  beforeEach: async ({ testUser }) => {
    // Additional setup if needed
  },

  // After each test
  afterEach: async ({ testUser }) => {
    await cleanupTestData(testUser.id);
  },

  // Before all tests
  beforeAll: async () => {
    // Global setup if needed
  },

  // After all tests
  afterAll: async () => {
    // Global cleanup if needed
  }
};

// Export common test data
export { testData }; 