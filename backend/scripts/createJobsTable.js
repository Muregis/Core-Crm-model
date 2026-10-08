const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function createJobsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS jobs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      job_id VARCHAR(100) UNIQUE NOT NULL,
      type VARCHAR(100) NOT NULL,
      status ENUM('waiting', 'active', 'completed', 'failed', 'delayed') DEFAULT 'waiting',
      priority INT DEFAULT 0,
      payload JSON,
      attempts INT DEFAULT 0,
      max_attempts INT DEFAULT 3,
      error_message TEXT,
      worker_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      failed_at TIMESTAMP NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_job_id (job_id),
      INDEX idx_type (type),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    );
  `;

  try {
    await db.query(query);
    logger.info('Jobs table created or already exists.');
  } catch (error) {
    logger.error('Error creating jobs table:', error);
  } finally {
    await db.close();
  }
}

createJobsTable();
