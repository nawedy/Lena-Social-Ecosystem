import { chromium, FullConfig } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set up test database
  await setupTestDatabase();

  // Create test user
  await createTestUser();

  // Set up test environment variables
  process.env.TEST_USER_EMAIL = 'test@example.com';
  process.env.TEST_USER_PASSWORD = 'Password123!';

  await browser.close();
}

async function setupTestDatabase() {
  // Clear existing test data
  await supabase
    .from('users')
    .delete()
    .eq('email', 'test@example.com');

  await supabase
    .from('profiles')
    .delete()
    .eq('email', 'test@example.com');

  // Reset sequences
  await supabase.rpc('reset_test_sequences');

  // Set up test data
  await setupTestProfiles();
  await setupTestContent();
  await setupTestAnalytics();
  await setupTestPayments();
}

async function createTestUser() {
  const { data: user, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'Password123!',
    options: {
      data: {
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      }
    }
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return user;
}

async function setupTestProfiles() {
  // Create test profiles
  const profiles = [
    {
      username: 'testuser1',
      full_name: 'Test User One',
      bio: 'Test bio 1',
      avatar_url: 'https://example.com/avatar1.jpg'
    },
    {
      username: 'testuser2',
      full_name: 'Test User Two',
      bio: 'Test bio 2',
      avatar_url: 'https://example.com/avatar2.jpg'
    }
  ];

  for (const profile of profiles) {
    await supabase.from('profiles').insert(profile);
  }
}

async function setupTestContent() {
  // Create test posts
  const posts = [
    {
      user_id: 'test_user_id',
      title: 'Test Post 1',
      content: 'Test content 1',
      type: 'video',
      url: 'https://example.com/video1.mp4'
    },
    {
      user_id: 'test_user_id',
      title: 'Test Post 2',
      content: 'Test content 2',
      type: 'photo',
      url: 'https://example.com/photo1.jpg'
    }
  ];

  for (const post of posts) {
    await supabase.from('posts').insert(post);
  }

  // Create test comments
  const comments = [
    {
      post_id: 1,
      user_id: 'test_user_id',
      content: 'Test comment 1'
    },
    {
      post_id: 1,
      user_id: 'test_user_id',
      content: 'Test comment 2'
    }
  ];

  for (const comment of comments) {
    await supabase.from('comments').insert(comment);
  }
}

async function setupTestAnalytics() {
  // Create test analytics data
  const analytics = [
    {
      user_id: 'test_user_id',
      event_type: 'view',
      content_id: 1,
      timestamp: new Date().toISOString()
    },
    {
      user_id: 'test_user_id',
      event_type: 'like',
      content_id: 1,
      timestamp: new Date().toISOString()
    }
  ];

  for (const event of analytics) {
    await supabase.from('analytics_events').insert(event);
  }
}

async function setupTestPayments() {
  // Create test payment methods
  const paymentMethods = [
    {
      user_id: 'test_user_id',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      exp_month: 12,
      exp_year: 2025
    },
    {
      user_id: 'test_user_id',
      type: 'crypto',
      wallet_address: '0x1234567890abcdef'
    }
  ];

  for (const method of paymentMethods) {
    await supabase.from('payment_methods').insert(method);
  }

  // Create test subscriptions
  const subscriptions = [
    {
      user_id: 'test_user_id',
      plan_id: 'pro',
      status: 'active',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  for (const subscription of subscriptions) {
    await supabase.from('subscriptions').insert(subscription);
  }

  // Create test transactions
  const transactions = [
    {
      user_id: 'test_user_id',
      amount: 1000,
      currency: 'usd',
      status: 'completed',
      type: 'subscription',
      created_at: new Date().toISOString()
    },
    {
      user_id: 'test_user_id',
      amount: 500,
      currency: 'usd',
      status: 'completed',
      type: 'one_time',
      created_at: new Date().toISOString()
    }
  ];

  for (const transaction of transactions) {
    await supabase.from('transactions').insert(transaction);
  }
}

export default globalSetup; 