import { stopRedis } from './redis';
import { stopMinio } from './minio';
import { stopElasticsearch } from './elasticsearch';
import { cleanupTestData } from './test-data';

export default async function globalTeardown() {
  console.log('🧹 Starting test environment cleanup...');

  try {
    // Cleanup test data
    console.log('🗑️  Cleaning up test data...');
    await cleanupTestData();
    console.log('✅ Test data cleanup complete');

    // Stop MongoDB memory server
    console.log('🛑 Stopping MongoDB memory server...');
    const mongod = global.__MONGOD__;
    if (mongod) {
      await mongod.stop();
      console.log('✅ MongoDB memory server stopped');
    }

    // Stop Redis
    console.log('🛑 Stopping Redis server...');
    await stopRedis();
    console.log('✅ Redis server stopped');

    // Stop MinIO
    console.log('🛑 Stopping MinIO server...');
    await stopMinio();
    console.log('✅ MinIO server stopped');

    // Stop Elasticsearch
    console.log('🛑 Stopping Elasticsearch...');
    await stopElasticsearch();
    console.log('✅ Elasticsearch stopped');

    console.log('✨ Test environment cleanup complete!');
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error);
    throw error;
  }
}

// Handle cleanup if process is interrupted
process.on('SIGTERM', async () => {
  console.log('🧹 Running emergency cleanup...');
  await globalTeardown().catch(console.error);
  process.exit(0);
}); 