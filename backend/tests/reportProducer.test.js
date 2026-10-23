/**
 * Unit test for enqueue options — mocks BullMQ so Redis is not required in CI.
 */
jest.mock('../src/queue/queues', () => {
  const store = new Map();
  return {
    reportQueue: {
      add: jest.fn().mockImplementation(async (name, data, opts) => {
        const id = (opts && opts.jobId) || 'mock-job-1';
        const job = { id, name, data };
        store.set(String(id), job);
        return job;
      }),
      getJob: jest.fn().mockImplementation(async (id) => store.get(String(id)) || null)
    },
    emailQueue: { add: jest.fn() },
    importQueue: { add: jest.fn() }
  };
});

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
    db.query.mockReset();
    db.query.mockResolvedValue([]);
  });

  test('requires tenantId and userId', async () => {
    await expect(enqueueReportJob({ reportType: 'sales', filters: {} })).rejects.toThrow(/tenantId/i);
  });

  test('adds generate_sales_report job with bounded retries', async () => {
    const job = await enqueueReportJob({
      reportType: 'sales',
      filters: {},
      tenantId: 1,
      userId: 7
    });

    expect(job.id).toBeDefined();
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

  test('returns existing job for same tenant idempotency key without throwing', async () => {
    db.query.mockResolvedValueOnce([{ job_id: 'tenant-3-fixed-key-abc', tenant_id: 3, status: 'waiting' }]);

    const job = await enqueueReportJob({
      reportType: 'sales',
      tenantId: 3,
      userId: 9,
      idempotencyKey: 'fixed-key-abc'
    });

    expect(job.id).toBe('tenant-3-fixed-key-abc');
    expect(reportQueue.add).not.toHaveBeenCalled();
  });
});
