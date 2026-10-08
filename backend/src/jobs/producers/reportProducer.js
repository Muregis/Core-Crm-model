const { reportQueue } = require('../../queue/queues');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function enqueueReportJob(data) {
  try {
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: false,
      removeOnFail: false,
      jobId: data.idempotencyKey || uuidv4(),
    };

    const job = await reportQueue.add('generate_sales_report', data, jobOptions);
    logger.info(`Enqueued report job ${job.id} of type ${data.reportType}`);
    return job;
  } catch (error) {
    logger.error('Error enqueueing report job:', error);
    throw error;
  }
}

module.exports = {
  enqueueReportJob
};
