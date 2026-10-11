jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name) => ({
      name,
      add: jest.fn().mockImplementation((jobName, data, opts) => 
        Promise.resolve({ id: opts?.jobId || 'mock-job-id', name: jobName, data })
      ),
      getJobCounts: jest.fn().mockResolvedValue({ active: 0, completed: 0, failed: 0 }),
      getJob: jest.fn().mockResolvedValue(null),
      getWorkers: jest.fn().mockResolvedValue([]),
      client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
      close: jest.fn().mockResolvedValue()
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      close: jest.fn().mockResolvedValue()
    }))
  };
});

const db = require('../src/config/database-sqlite');

beforeAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterAll(async () => {
  await db.close();
});

afterEach(async () => {
  // Clear transactional tables after each test
  const tables = [
    'token_blocklist', 'refresh_tokens', 'tenant_credentials',
    'jobs', 'activity_log', 'attachments', 'tasks', 'communications', 'mpesa_transactions', 
    'deals', 'leads', 'customer_tag_relations', 'customer_tags', 
    'customers', 'users', 'tenants'
  ];
  for (const table of tables) {
    try {
      await db.run(`DELETE FROM ${table}`);
    } catch (e) {
      // ignore
    }
  }
});
