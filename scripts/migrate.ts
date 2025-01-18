const fs = require('fs').promises;
const path = require('path');

const db = require('../src/db/connection').default;

async function runMigrations() {
  try {
    // Initialize database connection
    await db.initialize();

    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of executed migrations
    const { rows: executedMigrations } = await db.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedMigrationNames = new Set(executedMigrations.map(m => m.name));

    // Read migration files
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Execute new migrations
    for (const file of migrationFiles) {
      if (!executedMigrationNames.has(file)) {
        logger.info(`Running migration: ${file}`);

        const migrationPath = path.join(migrationsDir, file);
        const sql = await fs.readFile(migrationPath, 'utf-8');

        try {
          await db.query('BEGIN');
          await db.query(sql);
          await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await db.query('COMMIT');
          logger.info(`Successfully completed migration: ${file}`);
        } catch (error) {
          await db.query('ROLLBACK');
          console.error(`Failed to run migration ${file}:`, error);
          throw error;
        }
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runMigrations();
