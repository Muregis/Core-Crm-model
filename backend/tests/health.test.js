const request = require('supertest');
const app = require('../server');

describe('GET /health', () => {
  test('responds with status payload', async () => {
    const res = await request(app).get('/health');
    // 200 when DB up; 503 when degraded — both are valid API contracts
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('api');
  });
});
