import pg from 'pg';
import { config } from 'dotenv';
import os from 'os';

config();

const { Pool } = pg;
const systemUser = os.userInfo().username;

async function setupDatabase() {
  // Connect to default database first
  const pool = new Pool({
    user: systemUser,
    database: 'postgres',
    host: 'localhost',
    port: 5432,
  });

  try {
    // Create the application database
    await pool.query(`
      CREATE DATABASE tiktoktoe;
    `);
    console.log('Created database: tiktoktoe');

    // Create the application user
    await pool.query(`
      CREATE USER tiktoktoe_app WITH PASSWORD '${process.env.CLOUD_SQL_PASSWORD || 'development_password'}';
    `);
    console.log('Created user: tiktoktoe_app');

    // Connect to the new database
    const appPool = new Pool({
      user: systemUser,
      database: 'tiktoktoe',
      host: 'localhost',
      port: 5432,
    });

    // Grant privileges to the application user
    await appPool.query(`
      GRANT ALL PRIVILEGES ON DATABASE tiktoktoe TO tiktoktoe_app;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tiktoktoe_app;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tiktoktoe_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO tiktoktoe_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO tiktoktoe_app;
    `);
    console.log('Granted privileges to tiktoktoe_app');

    await appPool.end();
  } catch (error) {
    if (error.code === '42P04') {
      console.log('Database already exists');
    } else if (error.code === '42710') {
      console.log('User already exists');
    } else {
      console.error('Error setting up database:', error);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

setupDatabase().catch(console.error);
