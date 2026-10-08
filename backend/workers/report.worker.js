const fs = require('fs');
const path = require('path');
const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');

const REPORTS_DIR = path.join(__dirname, '..', 'uploads', 'reports');

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

async function generateSalesSummary() {
  // Support both mysql2 array shape and simple query wrappers
  let totalDeals = 0;
  let wonDeals = 0;
  let revenue = 0;

  try {
    const totalRows = await db.query('SELECT COUNT(*) as total_deals FROM deals');
    const wonRows = await db.query("SELECT COUNT(*) as won_deals FROM deals WHERE status = 'won'");
    const revRows = await db.query("SELECT COALESCE(SUM(value), 0) as revenue FROM deals WHERE status = 'won'");

    const unwrap = (rows) => {
      if (!rows) return {};
      if (Array.isArray(rows) && Array.isArray(rows[0])) return rows[0][0] || {};
      if (Array.isArray(rows)) return rows[0] || {};
      return rows;
    };

    totalDeals = Number(unwrap(totalRows).total_deals) || 0;
    wonDeals = Number(unwrap(wonRows).won_deals) || 0;
    revenue = Number(unwrap(revRows).revenue) || 0;
  } catch (e) {
    logger.warn('Sales report DB query failed; returning zeros', e.message);
  }

  return { totalDeals, wonDeals, revenue, generatedAt: new Date().toISOString() };
}

const processReport = async (job) => {
  logger.info(`Processing report job ${job.id}`);
  const { reportType } = job.data;

  if (reportType !== 'sales') {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  const summary = await generateSalesSummary();

  ensureReportsDir();
  const filename = `sales-report-${job.id}.csv`;
  const filepath = path.join(REPORTS_DIR, filename);
  const csv = [
    'metric,value',
    `total_deals,${summary.totalDeals}`,
    `won_deals,${summary.wonDeals}`,
    `revenue_kes,${summary.revenue}`,
    `generated_at,${summary.generatedAt}`
  ].join('\n');

  fs.writeFileSync(filepath, csv, 'utf8');

  // Persist result path on jobs audit row (best-effort)
  try {
    await db.query(
      `UPDATE jobs SET result_path = ?, result_json = ? WHERE job_id = ?`,
      [filepath, JSON.stringify(summary), String(job.id)]
    );
  } catch (e) {
    logger.warn('Could not update jobs.result_path (column may be missing):', e.message);
  }

  return {
    ...summary,
    resultPath: filepath,
    downloadHint: `/api/jobs/${job.id}/result`
  };
};

const setupReportWorker = () => {
  const worker = new Worker('report', processReport, {
    connection,
    concurrency: 2
  });

  worker.on('completed', (job) => {
    logger.info(`Report Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Report Job ${job && job.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Report Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupReportWorker, processReport };
