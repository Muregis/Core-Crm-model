/**
 * Authentication & protected-route integration tests.
 * No production credentials required.
 */
const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
  describe('POST /api/auth/login', () => {
    test('returns 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .set('Accept', 'application/json');

      expect([400, 422]).toContain(res.status);
    });

    test('returns 400 when email is malformed', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'secret12' });

      expect([400, 422]).toContain(res.status);
    });

    test('returns 400/401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success === false || res.body.message).toBeTruthy();
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('returns 401 with garbage Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(res.status).toBe(401);
    });
  });
});

describe('Protected resources without token', () => {
  const protectedPaths = [
    '/api/leads',
    '/api/customers',
    '/api/deals',
    '/api/jobs',
    '/api/tasks'
  ];

  test.each(protectedPaths)('%s returns 401 when unauthenticated', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });
});
