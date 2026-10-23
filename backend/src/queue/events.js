const { QueueEvents } = require('bullmq');
const connection = require('./connection');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Queue events mirror BullMQ lifecycle onto the jobs audit table.
 * Rules:
 * - Producers create rows WITH a trusted tenant_id.
 * - Events only UPDATE rows that already have tenant_id.
 * - Never update by job_id alone (no unscoped fallback).
 * - Attempts are owned by the worker, not incremented here.
 * - status=failed means retries exhausted.
 */

async function loadTenantScopedJob(jobId) {
  const rows = await db.query(
    'SELECT job_id, tenant_id, status, attempts, max_attempts FROM jobs WHERE job_id = ? LIMIT 1',
    [String(jobId)]
  );
  const row = rows && rows.length ? rows[0] : null;
  if (!row) return null;
  if (row.tenant_id == null || row.tenant_id === '') {
    logger.error('Refusing unscoped job update: missing tenant_id', { jobId });
    return null;
  }
  return row;
}

async function updateTenantJob(jobId, tenantId, sets, params) {
  await db.query(
    `UPDATE jobs SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?`,
    [...params, String(jobId), tenantId]
  );
}

const setupQueueEvents = (queueName) => {
  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('added', async ({ jobId, name }) => {
    try {
      const row = await loadTenantScopedJob(jobId);
      if (!row) return;
      await updateTenantJob(jobId, row.tenant_id, 'status = ?, type = ?', ['waiting', name]);
    } catch (e) {
      logger.error('Failed to log job added', { jobId, message: e.message });
    }
  });

  queueEvents.on('active', async ({ jobId }) => {
    try {
      const row = await loadTenantScopedJob(jobId);
      if (!row) return;
      await updateTenantJob(jobId, row.tenant_id, 'status = ?, started_at = CURRENT_TIMESTAMP', [
        'active'
      ]);
    } catch (e) {
      logger.error('Failed to log job active', { jobId, message: e.message });
    }
  });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    try {
      const row = await loadTenantScopedJob(jobId);
      if (!row) return;
      const resultJson =
        returnvalue == null
          ? null
          : typeof returnvalue === 'string'
            ? returnvalue
            : JSON.stringify(returnvalue);
      await updateTenantJob(
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
    try {
      const row = await loadTenantScopedJob(jobId);
      if (!row) return;

      const maxAttempts = Number(row.max_attempts) || 3;
      const attempts = Number(row.attempts) || 0;
      const isFinal = attempts >= maxAttempts;
      const reason = String(failedReason || 'failed').slice(0, 1000);

      if (isFinal) {
        await updateTenantJob(
          jobId,
          row.tenant_id,
          'status = ?, failed_at = CURRENT_TIMESTAMP, error_message = ?',
          ['failed', reason]
        );
      } else {
        await updateTenantJob(jobId, row.tenant_id, 'status = ?, error_message = ?', [
          'waiting',
          reason
        ]);
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
