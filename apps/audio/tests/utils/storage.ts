import { Web3Storage } from 'web3.storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });

export async function setupTestStorage() {
  // Create temporary test files
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-test-'));

  // Create test audio file
  const audioPath = path.join(tempDir, 'test.mp3');
  await fs.writeFile(audioPath, Buffer.from('fake mp3 data'));

  // Create test artwork file
  const artworkPath = path.join(tempDir, 'test.jpg');
  await fs.writeFile(artworkPath, Buffer.from('fake jpg data'));

  // Upload test files to IPFS
  const files = await Promise.all([
    Web3Storage.makeFileFromPath(audioPath),
    Web3Storage.makeFileFromPath(artworkPath),
  ]);

  const cid = await client.put(files);

  // Store CID for cleanup
  await fs.writeFile(path.join(tempDir, 'test-cid'), cid);

  // Clean up temporary files
  await fs.rm(tempDir, { recursive: true });
}

export async function cleanupTestStorage() {
  try {
    // Read test CID
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-test-'));
    const cidPath = path.join(tempDir, 'test-cid');
    const cid = await fs.readFile(cidPath, 'utf-8');

    // Delete test files from IPFS
    // Note: Web3.Storage doesn't support deletion, but we can unpin the files
    // This is just a placeholder for when deletion is supported
    console.log(`Would delete files with CID: ${cid}`);

    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true });
  } catch (error) {
    console.warn('Failed to clean up test storage:', error);
  }
} 