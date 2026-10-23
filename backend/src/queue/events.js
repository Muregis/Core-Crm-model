const { QueueEvents } = require('bullmq');
const connection = require('./connection');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Queue events mirror BullMQ lifecycle onto the jobs audit table.
 * Authority rules:
 * - Producers create rows WITH tenant_id.
 * - Events only UPDATE existing rows, preferably scoped by tenant_id.
 * - Attempts are owned by the worker (set from job.attemptsMade), not incremented here.
 * - "failed" status means retries are exhausted (final). Retryable failures stay "waiting"/"active".
 */

async function loadJobRow(jobId) {
  const rows = await db.query(
    'SELECT job_id, tenant_id, status, attempts, max_attempts FROM jobs WHERE job_id = ? LIMIT 1',
    [String(jobId)]
  );
  return rows && rows.length ? rows[0] : null;
}

async function updateJob(jobId, tenantId, sets, params) {
  if (tenantId != null && tenantId !== '') {
    await db.query(
      `UPDATE jobs SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?`,
      [...params, String(jobId), tenantId]
    );
  } else {
    await db.query(
      `UPDATE jobs SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE job_id = ?`,
      [...params, String(jobId)]
    );
  }
}

const setupQueueEvents = (queueName) => {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('added', async ({ jobId, name }) => {
    logger.info(`Queue event: job ${jobId} added to ${queueName}`);
    try {
      const row = await loadJobRow(jobId);
      if (!row) return;
      await updateJob(jobId, row.tenant_id, 'status = ?, type = ?', ['waiting', name]);
    } catch (e) {
      logger.error('Failed to log job added', { jobId, message: e.message });
    }
  });

  queueEvents.on('active', async ({ jobId }) => {
    logger.info(`Queue event: job ${jobId} active in ${queueName}`);
    try {
      const row = await loadJobRow(jobId);
      if (!row) return;
      await updateJob(jobId, row.tenant_id, 'status = ?, started_at = CURRENT_TIMESTAMP', ['active']);
    } catch (e) {
      logger.error('Failed to log job active', { jobId, message: e.message });
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    logger.info(`Queue event: job ${jobId} completed in ${queueName}`);
    try {
      const row = await loadJobRow(jobId);
      if (!row) return;
      const resultJson =
        returnvalue == null
          ? null
          : typeof returnvalue === 'string'
            ? returnvalue
            : JSON.stringify(returnvalue);
      await updateJob(
        jobId,
        row.tenant_id,
        'status = ?, completed_at = CURRENT_TIMESTAMP, result = ?, error_message = NULL, failed_at = NULL',
        ['completed', resultJson]
      );
    } catch (e) {
      logger.error('Failed to log job completed', { jobId, message: e.message });
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    logger.error(`Queue event: job ${jobId} failed in ${queueName}: ${failedReason}`);
    try {
      const row = await loadJobRow(jobId);
      if (!row) return;

      const maxAttempts = Number(row.max_attempts) || 3;
      const attempts = Number(row.attempts) || 0;
      const isFinal = attempts >= maxAttempts;

      if (isFinal) {
        await updateJob(
          jobId,
          row.tenant_id,
          'status = ?, failed_at = CURRENT_TIMESTAMP, error_message = ?',
          ['failed', String(failedReason || 'failed').slice(0, 1000)]
        );
      } else {
        await updateJob(
          jobId,
          row.tenant_id,
          'status = ?, error_message = ?',
          ['waiting', String(failedReason || 'failed').slice(0, 1000)]
        );
      }
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
