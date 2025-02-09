import { MongoClient } from 'mongodb';
import { Client } from '@elastic/elasticsearch';
import { createClient } from 'redis';
import { Client as MinioClient } from 'minio';
import { faker } from '@faker-js/faker';
import config from './env';

// Initialize clients
const mongoClient = new MongoClient(config.mongodb.uri);
const elasticClient = new Client({ node: config.elasticsearch.node });
const redisClient = createClient({ url: config.redis.url });
const minioClient = new MinioClient({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey
});

/**
 * Generate test users
 */
function generateUsers(count: number = 10) {
  return Array.from({ length: count }, () => ({
    email: faker.internet.email(),
    username: faker.internet.userName(),
    password: faker.internet.password(),
    profile: {
      name: faker.person.fullName(),
      avatar: faker.image.avatar(),
      bio: faker.lorem.paragraph(),
      location: faker.location.city(),
      website: faker.internet.url()
    },
    settings: {
      notifications: {
        email: true,
        push: true
      },
      privacy: {
        public: true
      },
      theme: 'light'
    },
    stats: {
      followers: faker.number.int({ min: 0, max: 1000 }),
      following: faker.number.int({ min: 0, max: 1000 }),
      posts: faker.number.int({ min: 0, max: 100 })
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent()
  }));
}

/**
 * Generate test content
 */
function generateContent(users: any[], count: number = 50) {
  return Array.from({ length: count }, () => {
    const user = faker.helpers.arrayElement(users);
    const type = faker.helpers.arrayElement(['video', 'image']);
    const status = faker.helpers.arrayElement(['queued', 'processing', 'completed', 'failed']);
    
    return {
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      type,
      url: faker.internet.url(),
      thumbnailUrl: faker.image.url(),
      userId: user._id,
      metadata: {
        tags: faker.lorem.words(3).split(' '),
        category: faker.helpers.arrayElement(['entertainment', 'education', 'gaming', 'music']),
        language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
        visibility: faker.helpers.arrayElement(['public', 'private', 'unlisted']),
        location: faker.location.city()
      },
      status,
      stats: {
        views: faker.number.int({ min: 0, max: 10000 }),
        likes: faker.number.int({ min: 0, max: 1000 }),
        comments: faker.number.int({ min: 0, max: 100 })
      },
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };
  });
}

/**
 * Generate test comments
 */
function generateComments(users: any[], content: any[], count: number = 200) {
  return Array.from({ length: count }, () => {
    const user = faker.helpers.arrayElement(users);
    const contentItem = faker.helpers.arrayElement(content);
    
    return {
      text: faker.lorem.paragraph(),
      userId: user._id,
      contentId: contentItem._id,
      likes: faker.number.int({ min: 0, max: 100 }),
      replies: [],
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };
  });
}

/**
 * Setup test data
 */
export async function setupTestData() {
  try {
    // Connect to services
    await mongoClient.connect();
    await redisClient.connect();
    
    const db = mongoClient.db();

    // Create collections
    const users = await db.collection('users');
    const content = await db.collection('content');
    const comments = await db.collection('comments');

    // Generate and insert test data
    console.log('Generating test users...');
    const testUsers = generateUsers();
    const insertedUsers = await users.insertMany(testUsers);

    console.log('Generating test content...');
    const testContent = generateContent(Object.values(insertedUsers.insertedIds));
    const insertedContent = await content.insertMany(testContent);

    console.log('Generating test comments...');
    const testComments = generateComments(
      Object.values(insertedUsers.insertedIds),
      Object.values(insertedContent.insertedIds)
    );
    await comments.insertMany(testComments);

    // Create indexes
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ username: 1 }, { unique: true });
    await content.createIndex({ userId: 1 });
    await content.createIndex({ type: 1 });
    await content.createIndex({ 'metadata.tags': 1 });
    await comments.createIndex({ contentId: 1 });
    await comments.createIndex({ userId: 1 });

    // Setup Elasticsearch indices
    await elasticClient.indices.create({
      index: config.elasticsearch.index,
      body: {
        mappings: {
          properties: {
            title: { type: 'text' },
            description: { type: 'text' },
            tags: { type: 'keyword' },
            category: { type: 'keyword' },
            userId: { type: 'keyword' },
            type: { type: 'keyword' },
            createdAt: { type: 'date' }
          }
        }
      }
    });

    // Index content in Elasticsearch
    const bulkBody = testContent.flatMap(doc => [
      { index: { _index: config.elasticsearch.index } },
      {
        title: doc.title,
        description: doc.description,
        tags: doc.metadata.tags,
        category: doc.metadata.category,
        userId: doc.userId.toString(),
        type: doc.type,
        createdAt: doc.createdAt
      }
    ]);

    await elasticClient.bulk({ body: bulkBody });

    // Setup MinIO bucket
    const bucketExists = await minioClient.bucketExists(config.minio.bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(config.minio.bucket);
    }

    // Cache frequently accessed data in Redis
    await redisClient.set('popular_content', JSON.stringify(
      testContent
        .sort((a, b) => b.stats.views - a.stats.views)
        .slice(0, 10)
    ));

    console.log('Test data setup completed successfully');
  } catch (error) {
    console.error('Error setting up test data:', error);
    throw error;
  } finally {
    // Close connections
    await mongoClient.close();
    await redisClient.disconnect();
  }
}

/**
 * Cleanup test data
 */
export async function cleanupTestData() {
  try {
    // Connect to services
    await mongoClient.connect();
    await redisClient.connect();
    
    const db = mongoClient.db();

    // Clear MongoDB collections
    await db.collection('users').deleteMany({});
    await db.collection('content').deleteMany({});
    await db.collection('comments').deleteMany({});

    // Clear Elasticsearch index
    await elasticClient.indices.delete({
      index: config.elasticsearch.index,
      ignore_unavailable: true
    });

    // Clear Redis cache
    await redisClient.flushDb();

    // Clear MinIO bucket
    const objectsList = await minioClient.listObjects(config.minio.bucket);
    for await (const obj of objectsList) {
      await minioClient.removeObject(config.minio.bucket, obj.name);
    }
    await minioClient.removeBucket(config.minio.bucket);

    console.log('Test data cleanup completed successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    throw error;
  } finally {
    // Close connections
    await mongoClient.close();
    await redisClient.disconnect();
  }
} 