import { MongoMemoryServer } from 'mongodb-memory-server';
import { startRedis } from './redis';
import { startMinio } from './minio';
import { startElasticsearch } from './elasticsearch';
import { setupTestData } from './test-data';
import { checkApiHealth } from '../api/utils/api-client';

let mongod: MongoMemoryServer;

export default async function globalSetup() {
  console.log('🚀 Starting test environment setup...');

  try {
    // Start MongoDB memory server
    console.log('📦 Starting MongoDB memory server...');
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-db',
        port: 27017
      }
    });
    const mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    console.log('✅ MongoDB memory server started');

    // Start Redis
    console.log('📦 Starting Redis server...');
    await startRedis();
    console.log('✅ Redis server started');

    // Start MinIO
    console.log('📦 Starting MinIO server...');
    await startMinio();
    console.log('✅ MinIO server started');

    // Start Elasticsearch
    console.log('📦 Starting Elasticsearch...');
    await startElasticsearch();
    console.log('✅ Elasticsearch started');

    // Wait for API to be healthy
    console.log('🔍 Checking API health...');
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      healthy = await checkApiHealth();
      if (healthy) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!healthy) {
      throw new Error('API health check failed');
    }
    console.log('✅ API is healthy');

    // Setup test data
    console.log('📝 Setting up test data...');
    await setupTestData();
    console.log('✅ Test data setup complete');

    // Store global references
    global.__MONGOD__ = mongod;

    console.log('✨ Test environment setup complete!');
  } catch (error) {
    console.error('❌ Test environment setup failed:', error);
    throw error;
  }
}

// Handle cleanup if process is interrupted
process.on('SIGTERM', async () => {
  console.log('🧹 Cleaning up test environment...');
  if (mongod) {
    await mongod.stop();
  }
  process.exit(0);
}); 