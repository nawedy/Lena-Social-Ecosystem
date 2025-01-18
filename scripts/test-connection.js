import pg from 'pg';
import { config } from 'dotenv';

config();

const { Pool } = pg;

async function testConnection() {
  const pool = new Pool({
    user: 'tiktoktoe_app',
    password: 'TikTokToe2025!',
    database: 'tiktoktoe',
    host: '34.136.230.198',
    port: 5432,
  });

  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('Connection successful:', result.rows[0]);
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
