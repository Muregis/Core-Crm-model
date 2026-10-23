process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
process.env.REDIS_URL = process.env.REDIS_URL || '';

jest.mock('bullmq', () => {
  const store = new Map();
  return {
    Queue: jest.fn().mockImplementation((name) => ({
      name,
      add: jest.fn().mockImplementation((jobName, data, opts) => {
        const id = (opts && opts.jobId) || `mock-job-${store.size + 1}`;
        const job = {
          id,
          name: jobName,
          data,
          opts: opts || {},
          attemptsMade: 0,
          getState: jest.fn().mockResolvedValue('waiting'),
          retry: jest.fn().mockResolvedValue()
        };
        store.set(String(id), job);
        return Promise.resolve(job);
      }),
      getJobCounts: jest.fn().mockResolvedValue({ active: 0, completed: 0, failed: 0 }),
      getJob: jest.fn().mockImplementation((id) => Promise.resolve(store.get(String(id)) || null)),
      getWorkers: jest.fn().mockResolvedValue([]),
      client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
      close: jest.fn().mockResolvedValue()
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue()
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue()
    }))
  };
});

const db = require('../src/config/database-sqlite');

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  const tables = [
    'token_blocklist',
    'refresh_tokens',
    'tenant_credentials',
    'jobs',
    'activity_log',
    'attachments',
    'tasks',
    'communications',
    'mpesa_transactions',
    'deals',
    'leads',
    'customer_tag_relations',
    'customer_tags',
    'customers',
    'users',
    'tenants'
  ];
  for (const table of tables) {
    try {
      await db.run(`DELETE FROM ${table}`);
    } catch (e) {
      // ignore
    }
  }
});
