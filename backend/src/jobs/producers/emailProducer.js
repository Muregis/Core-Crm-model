const { emailQueue } = require('../../queue/queues');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

async function enqueueEmailJob(data) {
  try {
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: false,
      removeOnFail: false,
      jobId: data.idempotencyKey || uuidv4(),
    };

    const job = await emailQueue.add('send_email', data, jobOptions);
    logger.info(`Enqueued email job ${job.id} for ${data.to}`);
    return job;
  } catch (error) {
    logger.error('Error enqueueing email job:', error);
    throw error;
  }
}

module.exports = {
  enqueueEmailJob
};
