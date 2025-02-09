import { Client as MinioClient } from 'minio';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Readable } from 'stream';
import config from './env';

let minioContainer: StartedTestContainer;
let minioClient: MinioClient;

/**
 * Start MinIO container and create client
 */
export async function startMinio(): Promise<void> {
  try {
    // Start MinIO container
    minioContainer = await new GenericContainer('minio/minio:latest')
      .withExposedPorts(9000, 9001)
      .withEnvironment({
        MINIO_ROOT_USER: config.minio.accessKey,
        MINIO_ROOT_PASSWORD: config.minio.secretKey
      })
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .withStartupTimeout(120000)
      .start();

    // Update MinIO configuration with container ports
    const apiPort = minioContainer.getMappedPort(9000);
    const consolePort = minioContainer.getMappedPort(9001);
    
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = apiPort.toString();
    process.env.MINIO_CONSOLE_PORT = consolePort.toString();

    // Create MinIO client
    minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT,
      port: apiPort,
      useSSL: false,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    });

    // Create test bucket if it doesn't exist
    const bucketExists = await minioClient.bucketExists(config.minio.bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(config.minio.bucket);
      console.log(`Created bucket: ${config.minio.bucket}`);
    }

    console.log('MinIO container started and client connected');
  } catch (error) {
    console.error('Failed to start MinIO:', error);
    throw error;
  }
}

/**
 * Stop MinIO container
 */
export async function stopMinio(): Promise<void> {
  try {
    if (minioContainer) {
      await minioContainer.stop();
      console.log('MinIO container stopped');
    }
  } catch (error) {
    console.error('Failed to stop MinIO:', error);
    throw error;
  }
}

/**
 * Get MinIO client instance
 */
export function getMinioClient(): MinioClient {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }
  return minioClient;
}

/**
 * Upload test file to MinIO
 */
export async function uploadTestFile(
  fileName: string,
  fileContent: Buffer | Readable,
  contentType: string = 'application/octet-stream'
): Promise<void> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    await minioClient.putObject(
      config.minio.bucket,
      fileName,
      fileContent,
      undefined,
      {
        'Content-Type': contentType
      }
    );
    console.log(`Uploaded test file: ${fileName}`);
  } catch (error) {
    console.error(`Failed to upload test file ${fileName}:`, error);
    throw error;
  }
}

/**
 * Download test file from MinIO
 */
export async function downloadTestFile(fileName: string): Promise<Buffer> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    const dataStream = await minioClient.getObject(config.minio.bucket, fileName);
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      dataStream.on('end', () => resolve(Buffer.concat(chunks)));
      dataStream.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download test file ${fileName}:`, error);
    throw error;
  }
}

/**
 * Delete test file from MinIO
 */
export async function deleteTestFile(fileName: string): Promise<void> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    await minioClient.removeObject(config.minio.bucket, fileName);
    console.log(`Deleted test file: ${fileName}`);
  } catch (error) {
    console.error(`Failed to delete test file ${fileName}:`, error);
    throw error;
  }
}

/**
 * Clear all files in test bucket
 */
export async function clearTestBucket(): Promise<void> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    const objectsList = minioClient.listObjects(config.minio.bucket, '', true);
    
    for await (const obj of objectsList) {
      await minioClient.removeObject(config.minio.bucket, obj.name);
    }
    
    console.log(`Cleared all files from bucket: ${config.minio.bucket}`);
  } catch (error) {
    console.error('Failed to clear test bucket:', error);
    throw error;
  }
}

/**
 * Check if file exists in MinIO
 */
export async function fileExists(fileName: string): Promise<boolean> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    await minioClient.statObject(config.minio.bucket, fileName);
    return true;
  } catch (error) {
    if ((error as any).code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get presigned URL for file
 */
export async function getPresignedUrl(
  fileName: string,
  expirySeconds: number = 3600
): Promise<string> {
  if (!minioClient) {
    throw new Error('MinIO client not initialized');
  }

  try {
    return await minioClient.presignedGetObject(
      config.minio.bucket,
      fileName,
      expirySeconds
    );
  } catch (error) {
    console.error(`Failed to generate presigned URL for ${fileName}:`, error);
    throw error;
  }
}

/**
 * Check MinIO health
 */
export async function checkMinioHealth(): Promise<boolean> {
  if (!minioClient) {
    return false;
  }

  try {
    await minioClient.bucketExists(config.minio.bucket);
    return true;
  } catch {
    return false;
  }
} 