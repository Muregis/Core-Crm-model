const { Worker } = require('bullmq');
const connection = require('../src/queue/connection');
const logger = require('../src/utils/logger');
// We will later add database integration for auditing

const processEmail = async (job) => {
  logger.info(`Processing email job ${job.id}`);
  const { to, subject, body } = job.data;

  // Validate required fields
  if (!to || !subject || !body) {
    logger.error(`Job ${job.id} failed: missing required email fields`);
    // Throwing an error marks the job as failed
    // Validation error shouldn't be retried indefinitely, but BullMQ handles max attempts
    throw new Error('Missing required email fields');
  }

  // Simulate email sending (e.g., SMTP or external API)
  logger.info(`Sending email to ${to} with subject "${subject}"...`);
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate a random transient failure 20% of the time to demonstrate retries
      if (Math.random() < 0.2) {
        const err = new Error('Simulated SMTP connection timeout');
        logger.warn(`Job ${job.id} transient failure: ${err.message}`);
        return reject(err);
      }
      
      logger.info(`Successfully sent email for job ${job.id}`);
      resolve({ deliveredAt: new Date().toISOString(), to });
    }, 1500); // simulate 1.5s delay
  });
};

const setupEmailWorker = () => {
  const worker = new Worker('email', processEmail, { 
    connection,
    concurrency: 5
  });

  worker.on('completed', (job, returnvalue) => {
    logger.info(`Email Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Email Job ${job.id} has failed with ${err.message}`);
  });

  worker.on('error', err => {
    logger.error(`Email Worker error: ${err.message}`);
  });

  return worker;
};

module.exports = { setupEmailWorker };
