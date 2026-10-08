const { enqueueEmailJob } = require('../src/jobs/producers/emailProducer');
const logger = require('../src/utils/logger');

async function runTest() {
  logger.info('Queueing 10 jobs for failure testing...');
  for (let i = 0; i < 10; i++) {
    await enqueueEmailJob({
      to: `test${i}@example.com`,
      subject: `Test ${i}`,
      body: `Testing failure recovery for job ${i}`,
      idempotencyKey: `test-email-${Date.now()}-${i}`
    });
  }
  
  logger.info('Successfully queued 10 jobs.');
  logger.info('To complete the test:');
  logger.info('1. Open two terminals and run: npm run worker');
  logger.info('2. Kill (Ctrl+C) the first terminal while jobs are processing');
  logger.info('3. Verify the second terminal picks up the remaining/stalled jobs and completes them.');
  process.exit(0);
}

runTest();
