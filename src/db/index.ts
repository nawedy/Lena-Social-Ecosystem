import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Pool } from 'pg';

import { logger } from '../utils/logger';

let pool: Pool;

export async function initializeDatabase() {
  if (pool) return pool;

  const connectionConfig = await getDatabaseConfig();

  pool = new Pool({
    ...connectionConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test the connection
  try {
    const client = await pool.connect();
    logger.info('Database connection successful');
    client.release();
  } catch (err) {
    logger.error(`Failed to connect to database: ${err.message}`, err);
    throw new Error(`Failed to connect to database: ${err.message}`);
  }

  return pool;
}

async function getDatabaseConfig() {
  if (process.env.NODE_ENV === 'production') {
    const gcpProjectId = process.env.GCP_PROJECT_ID;
    const secretName = process.env.DB_SECRET_NAME;
    const gcpRegion = process.env.GCP_REGION;

    if (!gcpProjectId || !secretName || !gcpRegion) {
      throw new Error(
        'GCP_PROJECT_ID, DB_SECRET_NAME, and GCP_REGION environment variables must be set.'
      );
    }

    const client = new SecretManagerServiceClient({
      apiEndpoint: `${gcpRegion}-secretmanager.googleapis.com`,
    });

    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${gcpProjectId}/secrets/${secretName}/versions/latest`,
      });

      if (!version.payload?.data) {
        throw new Error('Secret data is not available.');
      }
      const secret = JSON.parse(version.payload.data.toString());
    } catch (error) {
      throw new Error(
        `Failed to access secret from GCP Secret Manager: ${error.message}`
      );
    }
    const secret = JSON.parse(response.SecretString);

    return {
      host: secret.host,
      port: secret.port,
      database: secret.dbname,
      user: secret.username,
      password: secret.password,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  } else {
    // In development, use environment variables
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'tiktoktoe',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    logger.error(`Database query failed: ${error.message}`, error);
    throw new Error(`Database query failed: ${error.message}`);
  } finally {
    if (client) client.release();
  }
}

export async function transaction<T>(callback: (client: any) => Promise<T>) {
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    throw new Error(
      `Failed to connect to database in transaction: ${error.message}`
    );
  }
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error(`Database transaction failed: ${e.message}`, e);
    throw new Error(`Database transaction failed: ${e.message}`);
  } finally {
    client.release();
  }
}
