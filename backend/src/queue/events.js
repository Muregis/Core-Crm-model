const { QueueEvents } = require('bullmq');
const connection = require('./connection');
const logger = require('../utils/logger');
const db = require('../config/database');

const setupQueueEvents = (queueName) => {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('added', async ({ jobId, name }) => {
    logger.info(`Global Event: Job ${jobId} added to ${queueName}`);
    try {
      await db.query(
        `INSERT INTO jobs (job_id, type, status, created_at) VALUES (?, ?, 'waiting', NOW())
         ON DUPLICATE KEY UPDATE status='waiting', type=?`,
        [jobId, name, name]
      );
    } catch (e) {
      logger.error('Failed to log job added:', e);
    }
  });

  queueEvents.on('active', async ({ jobId }) => {
    logger.info(`Global Event: Job ${jobId} active in ${queueName}`);
    try {
      await db.query(
        `UPDATE jobs SET status = 'active', started_at = NOW(), attempts = attempts + 1 WHERE job_id = ?`,
        [jobId]
      );
    } catch (e) {
      logger.error('Failed to log job active:', e);
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info(`Global Event: Job ${jobId} completed in ${queueName}`);
    try {
      let resultJson = null;
      if (returnvalue != null) {
        resultJson = typeof returnvalue === 'string' ? returnvalue : JSON.stringify(returnvalue);
      }
      await db.query(
        `UPDATE jobs SET status = 'completed', completed_at = NOW(), result_json = COALESCE(?, result_json) WHERE job_id = ?`,
        [resultJson, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job completed:', e);
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error(`Global Event: Job ${jobId} failed in ${queueName}: ${failedReason}`);
    try {
      await db.query(
        `UPDATE jobs SET status = 'failed', failed_at = NOW(), error_message = ? WHERE job_id = ?`,
        [failedReason, jobId]
      );
    } catch (e) {
      logger.error('Failed to log job failed:', e);
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
