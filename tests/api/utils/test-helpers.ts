import { faker } from '@faker-js/faker';
import { api } from './api-client';

export interface TestUser {
  email: string;
  password: string;
  username: string;
  id?: string;
}

export interface TestContent {
  title: string;
  description: string;
  type: 'video' | 'image';
  metadata: {
    tags: string[];
    category: string;
    language: string;
    visibility: 'public' | 'private' | 'unlisted';
    [key: string]: any;
  };
}

/**
 * Generates a test user with random data
 */
export function generateTestUser(): TestUser {
  return {
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
    username: faker.internet.userName()
  };
}

/**
 * Generates test content data based on content type
 */
export function generateTestContent(type: 'video' | 'image'): TestContent {
  return {
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    type,
    metadata: {
      tags: faker.lorem.words(3).split(' '),
      category: faker.helpers.arrayElement(['entertainment', 'education', 'gaming', 'music']),
      language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
      visibility: faker.helpers.arrayElement(['public', 'private', 'unlisted']),
      location: faker.location.city(),
      createdAt: faker.date.recent().toISOString()
    }
  };
}

/**
 * Cleans up test user and associated data
 */
export async function cleanupTestUser(email: string): Promise<void> {
  try {
    // First try to login as the user
    const loginResponse = await api.post('/auth/login', {
      email,
      password: 'any-password' // We don't need the correct password for cleanup
    }).catch(() => null);

    if (loginResponse?.data?.token) {
      // Delete all user content
      await api.delete('/content/user/all', {
        headers: { Authorization: `Bearer ${loginResponse.data.token}` }
      }).catch(() => null);

      // Delete user account
      await api.delete('/auth/account', {
        headers: { Authorization: `Bearer ${loginResponse.data.token}` }
      }).catch(() => null);
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn(`Cleanup failed for user ${email}:`, error);
  }
}

/**
 * Generates test file data
 */
export function generateTestFile(type: 'video' | 'image'): Buffer {
  // In a real implementation, this would generate actual test files
  // For now, we'll create minimal valid files
  if (type === 'video') {
    return Buffer.from('fake-video-data');
  } else {
    return Buffer.from('fake-image-data');
  }
}

/**
 * Waits for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 30000,
  interval: number = 1000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Creates a test content item and returns its ID
 */
export async function createTestContent(
  type: 'video' | 'image',
  authToken: string
): Promise<string> {
  const content = generateTestContent(type);
  const file = generateTestFile(type);

  const formData = new FormData();
  formData.append('title', content.title);
  formData.append('description', content.description);
  formData.append(type, new Blob([file], { type: type === 'video' ? 'video/mp4' : 'image/jpeg' }));
  formData.append('metadata', JSON.stringify(content.metadata));

  const response = await api.post(`/content/${type}`, formData, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data.id;
}

/**
 * Generates test comment data
 */
export function generateTestComment(): { text: string } {
  return {
    text: faker.lorem.sentence()
  };
}

/**
 * Generates test view data
 */
export function generateTestViewData(): {
  watchTime: number;
  completionRate: number;
  quality: string;
} {
  return {
    watchTime: faker.number.int({ min: 10, max: 300 }),
    completionRate: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
    quality: faker.helpers.arrayElement(['480p', '720p', '1080p', '4K'])
  };
} 