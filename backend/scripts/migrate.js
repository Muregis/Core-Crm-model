const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

/**
 * Split SQL into executable statements.
 * Line/block comments are discarded (not attached to the next statement).
 * Does NOT support DELIMITER / stored procedures.
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        current += '\n';
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "'" && sql[i - 1] !== '\\') inSingle = false;
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"' && sql[i - 1] !== '\\') inDouble = false;
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.toUpperCase().startsWith('USE ')) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const trailing = current.trim();
  if (trailing.length > 0 && !trailing.toUpperCase().startsWith('USE ')) {
    statements.push(trailing);
  }

  return statements;
}

function isIgnorableError(message) {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('duplicate column') ||
    m.includes('already exists') ||
    m.includes('duplicate key name') ||
    m.includes('duplicate entry') ||
    m.includes('duplicate column name')
  );
}

async function ensureMigrationsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (_) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
}

async function runMigrations() {
  try {
    logger.info('Starting database migration runner...');
    await ensureMigrationsTable();

    const migrationsDir = path.join(__dirname, '../../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.info('No migrations directory found at ' + migrationsDir);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRows = await db.query('SELECT name FROM schema_migrations');
    const appliedSet = new Set((appliedRows || []).map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.info(`Migration already applied: ${file}`);
        continue;
      }

      logger.info(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const statements = splitStatements(sql);

      if (statements.length === 0) {
        throw new Error(`Migration ${file} produced zero executable statements`);
      }

      const failures = [];
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await db.query(statement);
        } catch (stmtError) {
          if (isIgnorableError(stmtError.message)) {
            logger.warn(
              `Migration ${file} statement ${i + 1} skipped (already applied): ${stmtError.message}`
            );
          } else {
            failures.push({
              index: i + 1,
              message: stmtError.message,
              preview: statement.slice(0, 120)
            });
          }
        }
      }

      if (failures.length > 0) {
        for (const f of failures) {
          logger.error(
            `Migration ${file} failed at statement ${f.index}: ${f.message} | ${f.preview}`
          );
        }
        throw new Error(
          `Migration ${file} failed (${failures.length} statement error(s)). Not recorded as applied.`
        );
      }

      await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      logger.info(`Successfully applied migration: ${file}`);
    }

    logger.info('Database migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

module.exports = runMigrations;
module.exports.splitStatements = splitStatements;

if (require.main === module) {
  runMigrations().then(() => {
    process.exit(0);
  });
}
