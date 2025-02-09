import { createClient } from 'redis';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import config from './env';

let redisContainer: StartedTestContainer;
let redisClient: ReturnType<typeof createClient>;

/**
 * Start Redis container and create client
 */
export async function startRedis(): Promise<void> {
  try {
    // Start Redis container
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withName('test-redis')
      .withStartupTimeout(120000)
      .start();

    // Update Redis URL with container port
    const mappedPort = redisContainer.getMappedPort(6379);
    process.env.REDIS_URL = `redis://localhost:${mappedPort}`;

    // Create Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            throw new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    // Handle Redis errors
    redisClient.on('error', (error: Error) => {
      console.error('Redis Client Error:', error);
    });

    // Connect to Redis
    await redisClient.connect();

    // Verify connection
    await redisClient.ping();
    console.log('Redis container started and client connected');
  } catch (error) {
    console.error('Failed to start Redis:', error);
    throw error;
  }
}

/**
 * Stop Redis container and disconnect client
 */
export async function stopRedis(): Promise<void> {
  try {
    // Disconnect client
    if (redisClient) {
      await redisClient.disconnect();
    }

    // Stop container
    if (redisContainer) {
      await redisContainer.stop();
    }

    console.log('Redis container stopped and client disconnected');
  } catch (error) {
    console.error('Failed to stop Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): ReturnType<typeof createClient> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Clear all data in Redis
 */
export async function clearRedis(): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  try {
    await redisClient.flushAll();
    console.log('Redis data cleared');
  } catch (error) {
    console.error('Failed to clear Redis data:', error);
    throw error;
  }
}

/**
 * Set test data in Redis
 */
export async function setTestData(key: string, value: any): Promise<void> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  try {
    await redisClient.set(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to set test data for key ${key}:`, error);
    throw error;
  }
}

/**
 * Get test data from Redis
 */
export async function getTestData(key: string): Promise<any> {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }

  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Failed to get test data for key ${key}:`, error);
    throw error;
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!redisClient) {
    return false;
  }

  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
} 