const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

const processReport = async (job) => {
  logger.info(`Processing report job ${job.id}`);
  const { reportType, filters, tenantId } = job.data;

  if (reportType === 'sales') {
    const params = tenantId ? [tenantId] : [];
    const tenantFilter = tenantId ? ' WHERE tenant_id = ?' : '';
    const tenantFilterAnd = tenantId ? ' AND tenant_id = ?' : '';

    const dealsResult = await db.query(`SELECT COUNT(*) as total_deals FROM deals${tenantFilter}`, params);
    const wonResult = await db.query(`SELECT COUNT(*) as won_deals FROM deals WHERE status = 'won'${tenantFilterAnd}`, params);
    const revResult = await db.query(`SELECT COALESCE(SUM(value), 0) as revenue FROM deals WHERE status = 'won'${tenantFilterAnd}`, params);

    const totalDeals = dealsResult[0]?.total_deals || 0;
    const wonDeals = wonResult[0]?.won_deals || 0;
    const revenue = revResult[0]?.revenue || 0;

    // Simulate long running async task outside test environment
    if (process.env.NODE_ENV !== 'test') {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const result = {
      totalDeals,
      wonDeals,
      revenue,
      generatedAt: new Date().toISOString()
    };

    try {
      await db.query(
        'UPDATE jobs SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE job_id = ?',
        ['completed', JSON.stringify(result), job.id]
      );
    } catch (dbErr) {
      logger.error('Failed to update jobs table on completion:', dbErr);
    }

    return result;
  }

  throw new Error(`Unknown report type: ${reportType}`);
};

const setupReportWorker = () => {
  const worker = new Worker('report', processReport, { 
    connection,
    concurrency: 2
  });

  worker.on('completed', (job, returnvalue) => {
    logger.info(`Report Job ${job.id} completed!`);
  });

  worker.on('failed', async (job, err) => {
    logger.error(`Report Job ${job?.id} failed with ${err.message}`);
    if (job?.id) {
      try {
        await db.query(
          'UPDATE jobs SET status = ?, error_message = ?, failed_at = CURRENT_TIMESTAMP WHERE job_id = ?',
          ['failed', err.message, job.id]
        );
      } catch (dbErr) {
        logger.error('Failed to update jobs table on failure:', dbErr);
      }
    }
  });

  worker.on('error', err => {
    logger.error(`Report Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupReportWorker, processReport };
