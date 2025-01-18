import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

const { Pool } = pg;

class DatabaseConnection {
  static instance;
  pool;
  initialized = false;

  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const config = this.getConnectionConfig();
      console.log('Connection config:', {
        ...config,
        password: '[REDACTED]',
      });

      this.pool = new Pool(config);

      // Test the connection
      await this.pool.query('SELECT NOW()');
      console.log('Database connection established successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  getConnectionConfig() {
    return {
      user: process.env.DB_USER || 'tiktoktoe_app',
      password: process.env.DB_PASSWORD || 'TikTokToe2025!',
      database: process.env.DB_NAME || 'tiktoktoe',
      host: process.env.DB_HOST || '34.136.230.198',
      port: parseInt(process.env.DB_PORT || '5432'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '10000'),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000'),
    };
  }

  async query(text, params) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async end() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default DatabaseConnection.getInstance();
