import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups');
  const backupFile = path.join(backupDir, `tiktoktoe-${timestamp}.sql`);

  try {
    // Create backups directory if it doesn't exist
    await fs.mkdir(backupDir, { recursive: true });

    // Create backup
    await new Promise((resolve, reject) => {
      const cmd = `PGPASSWORD='${process.env.CLOUD_SQL_PASSWORD || 'development_password'}' pg_dump -h localhost -U tiktoktoe_app -d tiktoktoe -F p -f "${backupFile}"`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Backup failed:', error);
          reject(error);
          return;
        }
        
        if (stderr) {
          console.error('Backup warnings:', stderr);
        }
        
        resolve(stdout);
      });
    });

    console.log(`Backup created successfully: ${backupFile}`);

    // Clean up old backups (keep last 5)
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort()
      .reverse();

    if (backupFiles.length > 5) {
      for (const file of backupFiles.slice(5)) {
        await fs.unlink(path.join(backupDir, file));
        console.log(`Deleted old backup: ${file}`);
      }
    }

    // Compress the backup
    await new Promise((resolve, reject) => {
      exec(`gzip "${backupFile}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('Compression failed:', error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });

    console.log(`Backup compressed: ${backupFile}.gz`);
  } catch (error) {
    console.error('Backup process failed:', error);
    process.exit(1);
  }
}

backupDatabase().catch(console.error);
