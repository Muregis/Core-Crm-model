const { QueueEvents } = require('bullmq');
const connection = require('./connection');
const logger = require('../utils/logger');
const db = require('../config/database');

const setupQueueEvents = (queueName) => {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('added', async ({ jobId, name }) => {
    logger.info(`Global Event: Job ${jobId} added to ${queueName}`);
    try {
      const existing = await db.query('SELECT id FROM jobs WHERE job_id = ?', [jobId]);
      if (existing && existing.length > 0) {
        await db.query(
          'UPDATE jobs SET status = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
          ['waiting', name, jobId]
        );
      } else {
        await db.query(
          'INSERT INTO jobs (job_id, type, status, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [jobId, name, 'waiting']
        );
      }
    } catch (e) {
      logger.error('Failed to log job added:', e);
    }
  });

  queueEvents.on('active', async ({ jobId, prev }) => {
    logger.info(`Global Event: Job ${jobId} active in ${queueName}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, started_at = CURRENT_TIMESTAMP, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['active', jobId]
      );
    } catch (e) {
      logger.error('Failed to log job active:', e);
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info(`Global Event: Job ${jobId} completed in ${queueName}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, completed_at = CURRENT_TIMESTAMP, result = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['completed', returnvalue ? JSON.stringify(returnvalue) : null, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job completed:', e);
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error(`Global Event: Job ${jobId} failed in ${queueName}: ${failedReason}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, failed_at = CURRENT_TIMESTAMP, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['failed', failedReason, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job failed:', e);
    }
  });
  
  return queueEvents;
};

// Initialize listeners
const emailEvents = setupQueueEvents('email');
const reportEvents = setupQueueEvents('report');
const importEvents = setupQueueEvents('import');

module.exports = {
  emailEvents,
  reportEvents,
  importEvents,
};
