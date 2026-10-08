const logger = require('../src/utils/logger');
const { setupEmailWorker } = require('./email.worker');
const { setupReportWorker } = require('./report.worker');
const { setupImportWorker } = require('./import.worker');
require('../src/queue/events'); // Initialize global queue events to log to DB

logger.info('Starting Background Workers...');

const workers = [];

try {
  const emailWorker = setupEmailWorker();
  workers.push(emailWorker);
  logger.info('Email worker started');
  
  const reportWorker = setupReportWorker();
  workers.push(reportWorker);
  logger.info('Report worker started');

  const importWorker = setupImportWorker();
  workers.push(importWorker);
  logger.info('Import worker started');

} catch (error) {
  logger.error('Failed to start workers:', error);
  process.exit(1);
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, closing workers...`);
  try {
    for (const worker of workers) {
      await worker.close();
    }
    logger.info('All workers closed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during worker shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
