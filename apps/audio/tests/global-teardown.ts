import { FullConfig } from '@playwright/test';
import { cleanupTestDatabase } from './utils/database';
import { cleanupTestStorage } from './utils/storage';
import fs from 'fs/promises';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  // Clean up test database
  await cleanupTestDatabase();

  // Clean up test storage
  await cleanupTestStorage();

  // Clean up auth state
  try {
    await fs.rm(path.join(__dirname, '.auth'), { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up auth state:', error);
  }

  // Clean up test artifacts
  const artifactsPath = path.join(__dirname, '../test-results');
  try {
    await fs.rm(artifactsPath, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up test artifacts:', error);
  }

  // Clean up coverage reports
  const coveragePath = path.join(__dirname, '../coverage');
  try {
    await fs.rm(coveragePath, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to clean up coverage reports:', error);
  }
}

export default globalTeardown; 