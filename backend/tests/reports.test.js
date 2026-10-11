const request = require('supertest');
const app = require('../server');

describe('POST /api/reports', () => {
  test('returns 401 without Authorization', async () => {
    const res = await request(app)
      .post('/api/reports')
      .send({ reportType: 'sales' });

    expect(res.status).toBe(401);
  });

  test('returns 401 with invalid token', async () => {
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', 'Bearer invalid.token')
      .send({ reportType: 'sales' });

    expect(res.status).toBe(401);
  });
});
