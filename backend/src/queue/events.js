const { QueueEvents } = require('bullmq');
const connection = require('./connection');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Queue events only UPDATE existing job audit rows.
 * Job rows are created by producers with a trusted tenant_id.
 * Never INSERT here without tenant context — that would break isolation.
 */
const setupQueueEvents = (queueName) => {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('added', async ({ jobId, name }) => {
    logger.info(`Queue event: job ${jobId} added to ${queueName}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, type = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['waiting', name, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job added', { jobId, message: e.message });
    }
  });

  queueEvents.on('active', async ({ jobId }) => {
    logger.info(`Queue event: job ${jobId} active in ${queueName}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, started_at = CURRENT_TIMESTAMP, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['active', jobId]
      );
    } catch (e) {
      logger.error('Failed to log job active', { jobId, message: e.message });
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info(`Queue event: job ${jobId} completed in ${queueName}`);
    try {
      const resultJson =
        returnvalue == null
          ? null
          : typeof returnvalue === 'string'
            ? returnvalue
            : JSON.stringify(returnvalue);
      await db.query(
        'UPDATE jobs SET status = ?, completed_at = CURRENT_TIMESTAMP, result = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['completed', resultJson, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job completed', { jobId, message: e.message });
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error(`Queue event: job ${jobId} failed in ${queueName}: ${failedReason}`);
    try {
      await db.query(
        'UPDATE jobs SET status = ?, failed_at = CURRENT_TIMESTAMP, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['failed', String(failedReason || 'failed').slice(0, 1000), jobId]
      );
    } catch (e) {
      logger.error('Failed to log job failed', { jobId, message: e.message });
    }
  });

  return queueEvents;
};

const emailEvents = setupQueueEvents('email');
const reportEvents = setupQueueEvents('report');
const importEvents = setupQueueEvents('import');

module.exports = {
  emailEvents,
  reportEvents,
  importEvents
};
