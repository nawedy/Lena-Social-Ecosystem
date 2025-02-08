import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { setupTestDatabase } from './utils/database';
import { setupTestStorage } from './utils/storage';

async function globalSetup(config: FullConfig) {
  // Set up test database
  await setupTestDatabase();

  // Set up test storage
  await setupTestStorage();

  // Set up test browser for auth state
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Sign in test user
  const { error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'test123',
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  // Save signed-in state
  await page.context().storageState({ path: './tests/.auth/user.json' });

  await browser.close();
}

export default globalSetup; 