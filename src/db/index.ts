import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Pool } from 'pg';

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
    console.error('Failed to connect to database:', err);
    throw err;
  }

  return pool;
}

async function getDatabaseConfig() {
  if (process.env.NODE_ENV === 'production') {
    // In production, get credentials from Secret Manager
    const client = new SecretsManagerClient({ region: 'us-central1' });
    const command = new GetSecretValueCommand({
      SecretId: process.env.DB_SECRET_NAME,
    });

    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString || '{}');

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

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function transaction<T>(callback: (client: any) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
