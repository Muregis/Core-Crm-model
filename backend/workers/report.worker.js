const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

function unwrapFirstRow(rows) {
  if (!Array.isArray(rows)) return rows || {};
  if (Array.isArray(rows[0])) return rows[0][0] || {};
  return rows[0] || {};
}

async function generateSalesSummary(tenantId) {
  if (!Number.isInteger(Number(tenantId)) || Number(tenantId) <= 0) {
    throw new Error('Refusing to generate a report without a valid tenant');
  }

  const totalRows = await db.query(
    'SELECT COUNT(*) AS total_deals FROM deals WHERE tenant_id = ?',
    [tenantId]
  );
  const wonRows = await db.query(
    "SELECT COUNT(*) AS won_deals FROM deals WHERE tenant_id = ? AND status = 'won'",
    [tenantId]
  );
  const revenueRows = await db.query(
    "SELECT COALESCE(SUM(value), 0) AS revenue FROM deals WHERE tenant_id = ? AND status = 'won'",
    [tenantId]
  );

  return {
    tenantId: Number(tenantId),
    totalDeals: Number(unwrapFirstRow(totalRows).total_deals) || 0,
    wonDeals: Number(unwrapFirstRow(wonRows).won_deals) || 0,
    revenueKes: Number(unwrapFirstRow(revenueRows).revenue) || 0,
    generatedAt: new Date().toISOString()
  };
}

async function processReport(job) {
  const { reportType, tenantId } = job.data || {};
  if (reportType !== 'sales') {
    throw new Error(`Unsupported report type: ${reportType || 'missing'}`);
  }
  if (!tenantId) {
    throw new Error('Report job is missing tenant context');
  }

  const attemptNumber = (job.attemptsMade || 0) + 1;

  await db.query(
    'UPDATE jobs SET status = ?, started_at = CURRENT_TIMESTAMP, attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
    ['active', attemptNumber, String(job.id), tenantId]
  );

  logger.info('Processing tenant-scoped sales report', {
    jobId: job.id,
    tenantId,
    attempt: attemptNumber
  });

  try {
    const result = await generateSalesSummary(tenantId);
    await db.query(
      'UPDATE jobs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP, error_message = NULL, failed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
      ['completed', JSON.stringify(result), String(job.id), tenantId]
    );
    return result;
  } catch (error) {
    await db.query(
      'UPDATE jobs SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
      ['waiting', String(error.message || 'Report failed').slice(0, 1000), String(job.id), tenantId]
    ).catch((persistError) => {
      logger.error('Could not persist report failure state', {
        jobId: job.id,
        message: persistError.message
      });
    });
    throw error;
  }
}

function setupReportWorker() {
  const worker = new Worker('report', processReport, {
    connection,
    concurrency: 2
  });

  worker.on('completed', (job) => {
    logger.info('Report job completed', { jobId: job.id, tenantId: job.data?.tenantId });
  });

  worker.on('failed', async (job, error) => {
    if (!job?.id) return;
    const tenantId = job.data?.tenantId;
    const maxAttempts = (job.opts && job.opts.attempts) || 3;
    const attemptsMade = job.attemptsMade || 0;
    const isFinal = attemptsMade >= maxAttempts;

    logger.error('Report job failed', {
      jobId: job.id,
      tenantId,
      message: error.message,
      attemptsMade,
      maxAttempts,
      isFinal
    });

    if (!tenantId) return;

    if (isFinal) {
      await db.query(
        'UPDATE jobs SET status = ?, error_message = ?, failed_at = CURRENT_TIMESTAMP, attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
        ['failed', String(error.message || 'Report failed').slice(0, 1000), attemptsMade, String(job.id), tenantId]
      ).catch((persistError) => {
        logger.error('Could not persist final report failure', {
          jobId: job.id,
          message: persistError.message
        });
      });
    } else {
      await db.query(
        'UPDATE jobs SET status = ?, error_message = ?, attempts = ?, updated_at = CURRENT_TIMESTAMP WHERE job_id = ? AND tenant_id = ?',
        ['waiting', String(error.message || 'Report failed').slice(0, 1000), attemptsMade, String(job.id), tenantId]
      ).catch(() => {});
    }
  });

  worker.on('error', (error) => {
    logger.error('Report worker error', { message: error.message });
  });

  return worker;
}

module.exports = { setupReportWorker, processReport, generateSalesSummary };
