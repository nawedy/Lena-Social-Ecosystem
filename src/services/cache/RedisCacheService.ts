import { createClient } from 'redis';

// Retrieve the Redis connection URL from environment variables. Make sure it is set in your deployment.
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set.');
}

const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
  // Implement error handling and retry logic.
});

redisClient.on('connect', () => {
  console.log('Connected to Redis.');
});

await redisClient.connect();

export const getCachedData = async (key: string) => {
  const data = await redisClient.get(key);
  if (data) {
    console.log(\`Cache hit for key: \${key}\`);
    return JSON.parse(data); // Assumes data is stored as JSON. Adjust parsing as needed.
  }
  console.log(\`Cache miss for key: \${key}\`);
  return null;
};

export const setCachedData = async (key: string, data: any, expirySeconds: number) => {
  await redisClient.setEx(key, expirySeconds, JSON.stringify(data));
  console.log(\`Cached data for key: \${key}\`);
};

export default redisClient;
