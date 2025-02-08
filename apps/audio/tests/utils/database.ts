import { createClient } from '@supabase/supabase-js';
import { Database } from '../../src/lib/types/database';

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function setupTestDatabase() {
  // Create test user
  const { error: userError } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'test123',
    email_confirm: true,
  });

  if (userError) {
    throw new Error(`Failed to create test user: ${userError.message}`);
  }

  // Insert test data
  await Promise.all([
    // Insert test genres
    supabase.from('audio_genres').insert([
      { name: 'Rock', slug: 'rock' },
      { name: 'Jazz', slug: 'jazz' },
      { name: 'Electronic', slug: 'electronic' },
    ]),

    // Insert test tracks
    supabase.from('audio_tracks').insert([
      {
        title: 'Test Track 1',
        description: 'A test track',
        audio_url: 'https://example.com/track1.mp3',
        artwork_url: 'https://example.com/artwork1.jpg',
        duration: 180,
        price: 0.99,
        currency: 'USD',
      },
      {
        title: 'Test Track 2',
        description: 'Another test track',
        audio_url: 'https://example.com/track2.mp3',
        artwork_url: 'https://example.com/artwork2.jpg',
        duration: 240,
        price: 1.99,
        currency: 'USD',
      },
    ]),
  ]);
}

export async function cleanupTestDatabase() {
  // Delete test data in reverse order of dependencies
  await Promise.all([
    supabase.from('audio_reviews').delete().neq('id', 0),
    supabase.from('audio_licenses').delete().neq('id', 0),
    supabase.from('audio_orders').delete().neq('id', 0),
    supabase.from('audio_track_genres').delete().neq('id', 0),
  ]);

  await Promise.all([
    supabase.from('audio_tracks').delete().neq('id', 0),
    supabase.from('audio_genres').delete().neq('id', 0),
  ]);

  // Delete test user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const testUser = users.find(user => user.email === 'test@example.com');

  if (testUser) {
    await supabase.auth.admin.deleteUser(testUser.id);
  }
} 