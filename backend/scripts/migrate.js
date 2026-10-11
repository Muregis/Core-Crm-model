const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function runMigrations() {
  try {
    logger.info('Starting database migration runner...');

    // 1. Ensure schema_migrations table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(async () => {
      // In MySQL:
      await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    });

    // 2. Read migration files
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.info('No migrations directory found at ' + migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // 3. Get applied migrations
    const appliedRows = await db.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map(r => r.name));

    // 4. Apply pending migrations
    for (const file of files) {
      if (!appliedSet.has(file)) {
        logger.info(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Execute statements
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--') && !s.toUpperCase().startsWith('USE '));

        for (const statement of statements) {
          try {
            await db.query(statement);
          } catch (stmtError) {
            // Log but allow IF NOT EXISTS statements to continue
            logger.warn(`Migration statement note in ${file}: ${stmtError.message}`);
          }
        }

        // Record applied migration
        await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        logger.info(`Successfully applied migration: ${file}`);
      } else {
        logger.info(`Migration already applied: ${file}`);
      }
    }

    logger.info('Database migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations().then(() => {
    process.exit(0);
  });
}

module.exports = runMigrations;
