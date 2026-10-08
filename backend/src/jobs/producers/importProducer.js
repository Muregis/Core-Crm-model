const { importQueue } = require('../../queue/queues');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function enqueueImportJob(data) {
  try {
    const jobOptions = {
      attempts: 1, // Imports usually shouldn't be retried automatically if validation fails
      removeOnComplete: false,
      removeOnFail: false,
      jobId: data.idempotencyKey || uuidv4(),
    };

    const job = await importQueue.add('import_customers', data, jobOptions);
    logger.info(`Enqueued import job ${job.id}`);
    return job;
  } catch (error) {
    logger.error('Error enqueueing import job:', error);
    throw error;
  }
}

module.exports = {
  enqueueImportJob
};
