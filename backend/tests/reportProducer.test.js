/**
 * Unit test for enqueue options — mocks BullMQ so Redis is not required in CI.
 */
jest.mock('../src/queue/queues', () => ({
  reportQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-1' }),
    getJob: jest.fn().mockResolvedValue(null)
  },
  emailQueue: { add: jest.fn() },
  importQueue: { add: jest.fn() }
}));

jest.mock('../src/config/database', () => ({
  query: jest.fn().mockResolvedValue([])
}));

const { reportQueue } = require('../src/queue/queues');
const db = require('../src/config/database');
const { enqueueReportJob } = require('../src/jobs/producers/reportProducer');

describe('enqueueReportJob', () => {
  beforeEach(() => {
    reportQueue.add.mockClear();
    reportQueue.getJob.mockClear();
    db.query.mockClear();
    db.query.mockResolvedValue([]);
  });

  test('requires tenantId and userId', async () => {
    await expect(
      enqueueReportJob({ reportType: 'sales', filters: {} })
    ).rejects.toThrow(/tenantId/i);
  });

  test('adds generate_sales_report job with bounded retries', async () => {
    const job = await enqueueReportJob({
      reportType: 'sales',
      filters: {},
      tenantId: 1,
      userId: 7
    });

    expect(job.id).toBe('mock-job-1');
    expect(reportQueue.add).toHaveBeenCalledTimes(1);

    const [name, data, options] = reportQueue.add.mock.calls[0];
    expect(name).toBe('generate_sales_report');
    expect(data.reportType).toBe('sales');
    expect(data.tenantId).toBe(1);
    expect(data.userId).toBe(7);
    expect(options.attempts).toBe(3);
    expect(options.backoff).toEqual({ type: 'exponential', delay: 5000 });
    expect(options.removeOnComplete).toBe(false);
  });

  test('prefixes idempotency key with tenant', async () => {
    await enqueueReportJob({
      reportType: 'sales',
      tenantId: 3,
      userId: 9,
      idempotencyKey: 'fixed-key-abc'
    });

    const options = reportQueue.add.mock.calls[0][2];
    expect(options.jobId).toBe('tenant-3-fixed-key-abc');
  });
});
