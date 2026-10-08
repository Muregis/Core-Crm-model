const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
const db = require('../src/config/database');
const fs = require('fs');

// We simulate CSV processing here
const processImport = async (job) => {
  logger.info(`Processing import job ${job.id}`);
  const { filePath } = job.data;

  if (!filePath) {
    throw new Error('No filePath provided for import');
  }

  // Simulate reading and processing a CSV
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Here we would normally use a library like 'csv-parser'
  // and insert each row into the customers table using db.query()

  // Simulating validation and insertion
  const totalRows = 500;
  const successful = 490;
  const failed = 10;
  const errors = [{ row: 12, reason: 'Missing email' }, { row: 45, reason: 'Invalid phone' }];

  // Optionally delete the temp file
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    logger.warn(`Could not delete file ${filePath}`);
  }
  
  return {
    totalProcessed: totalRows,
    successful,
    failed,
    errors
  };
};

const setupImportWorker = () => {
  const worker = new Worker('import', processImport, { 
    connection,
    concurrency: 1 // usually we want 1 to prevent db locks for large inserts
  });

  worker.on('completed', (job, returnvalue) => {
    logger.info(`Import Job ${job.id} completed! Processed ${returnvalue.totalProcessed}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Import Job ${job.id} failed with ${err.message}`);
  });

  worker.on('error', err => {
    logger.error(`Import Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupImportWorker };
