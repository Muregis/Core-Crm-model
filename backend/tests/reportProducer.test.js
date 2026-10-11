/**
 * Unit test for enqueue options — mocks BullMQ so Redis is not required in CI.
 */
jest.mock('../src/queue/queues', () => ({
  reportQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-1' })
  },
  emailQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() }
}));

const { reportQueue } = require('../src/queue/queues');
const { enqueueReportJob } = require('../src/jobs/producers/reportProducer');

describe('enqueueReportJob', () => {
  beforeEach(() => {
    reportQueue.add.mockClear();
  });

  test('adds generate_sales_report job with bounded retries', async () => {
    const job = await enqueueReportJob({
      reportType: 'sales',
      filters: {},
      requestedBy: 1
    });

    expect(job.id).toBe('mock-job-1');
    expect(reportQueue.add).toHaveBeenCalledTimes(1);

    const [name, data, options] = reportQueue.add.mock.calls[0];
    expect(name).toBe('generate_sales_report');
    expect(data.reportType).toBe('sales');
    expect(options.attempts).toBe(3);
    expect(options.backoff).toEqual({ type: 'exponential', delay: 5000 });
    expect(options.removeOnComplete).toBe(false);
  });

  test('honours idempotency key as jobId', async () => {
    await enqueueReportJob({
      reportType: 'sales',
      idempotencyKey: 'fixed-key-abc'
    });

    const options = reportQueue.add.mock.calls[0][2];
    expect(options.jobId).toBe('fixed-key-abc');
  });
});
