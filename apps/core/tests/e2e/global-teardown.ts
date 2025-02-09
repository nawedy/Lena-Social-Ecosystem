import { FullConfig } from '@playwright/test';
import { supabase } from '$lib/supabaseClient';

async function globalTeardown(config: FullConfig) {
  // Clean up test database
  await cleanupTestDatabase();

  // Clean up test user
  await cleanupTestUser();

  // Clean up test files
  await cleanupTestFiles();

  // Clean up environment variables
  delete process.env.TEST_USER_EMAIL;
  delete process.env.TEST_USER_PASSWORD;
}

async function cleanupTestDatabase() {
  // Clean up test data in reverse order of creation to handle foreign key constraints
  await cleanupTransactions();
  await cleanupPayments();
  await cleanupAnalytics();
  await cleanupContent();
  await cleanupProfiles();
}

async function cleanupTestUser() {
  // Delete test user from auth
  const { error } = await supabase.auth.admin.deleteUser('test_user_id');
  
  if (error) {
    console.error(`Failed to delete test user: ${error.message}`);
  }
}

async function cleanupTransactions() {
  // Delete test transactions
  await supabase
    .from('transactions')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test subscriptions
  await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test payment methods
  await supabase
    .from('payment_methods')
    .delete()
    .eq('user_id', 'test_user_id');
}

async function cleanupPayments() {
  // Delete test invoices
  await supabase
    .from('invoices')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test refunds
  await supabase
    .from('refunds')
    .delete()
    .eq('user_id', 'test_user_id');
}

async function cleanupAnalytics() {
  // Delete test analytics events
  await supabase
    .from('analytics_events')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test metrics
  await supabase
    .from('user_metrics')
    .delete()
    .eq('user_id', 'test_user_id');
}

async function cleanupContent() {
  // Delete test comments
  await supabase
    .from('comments')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test likes
  await supabase
    .from('likes')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test shares
  await supabase
    .from('shares')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test posts
  await supabase
    .from('posts')
    .delete()
    .eq('user_id', 'test_user_id');
}

async function cleanupProfiles() {
  // Delete test profiles
  await supabase
    .from('profiles')
    .delete()
    .eq('email', 'test@example.com');

  // Delete test followers/following relationships
  await supabase
    .from('follows')
    .delete()
    .or(`follower_id.eq.test_user_id,following_id.eq.test_user_id`);

  // Delete test notifications
  await supabase
    .from('notifications')
    .delete()
    .eq('user_id', 'test_user_id');

  // Delete test settings
  await supabase
    .from('user_settings')
    .delete()
    .eq('user_id', 'test_user_id');
}

async function cleanupTestFiles() {
  try {
    // Delete test avatars
    await supabase
      .storage
      .from('avatars')
      .remove(['test_user_id']);

    // Delete test media
    await supabase
      .storage
      .from('media')
      .remove(['test_user_id']);

    // Delete test documents
    await supabase
      .storage
      .from('documents')
      .remove(['test_user_id']);

    // Delete test exports
    await supabase
      .storage
      .from('exports')
      .remove(['test_user_id']);

  } catch (error) {
    console.error('Failed to cleanup test files:', error);
  }
}

export default globalTeardown; 