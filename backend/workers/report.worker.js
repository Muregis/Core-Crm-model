const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

const processReport = async (job) => {
  logger.info(`Processing report job ${job.id}`);
  const { reportType, filters } = job.data;

  if (reportType === 'sales') {
    // Generate sales report using actual database queries
    // E.g. total deals, won deals, revenue, etc.
    // Assuming MySQL usage as per the architecture:
    const [[{ total_deals }]] = await db.query('SELECT COUNT(*) as total_deals FROM deals');
    const [[{ won_deals }]] = await db.query('SELECT COUNT(*) as won_deals FROM deals WHERE status = "won"');
    const [[{ revenue }]] = await db.query('SELECT COALESCE(SUM(value), 0) as revenue FROM deals WHERE status = "won"');
    
    // Simulate long running task
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      totalDeals: total_deals,
      wonDeals: won_deals,
      revenue,
      generatedAt: new Date().toISOString()
    };
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

  worker.on('failed', (job, err) => {
    logger.error(`Report Job ${job.id} failed with ${err.message}`);
  });

  worker.on('error', err => {
    logger.error(`Report Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupReportWorker };
