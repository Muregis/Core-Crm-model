const request = require('supertest');
const app = require('../server');

describe('Auth Endpoints', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    phone: '+254712345678',
    tenantName: 'Test Corp'
  };

  it('should register a new user and create a tenant', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email);
    expect(res.body.data.user.tenant_id).toBeDefined();
  });

  it('should not register user with existing email', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        ...testUser,
        phone: '+254709876543'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('should login an existing user', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should not login with wrong password', async () => {
    await request(app).post('/api/auth/register').send(testUser);

    const res = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'wrongpassword'
    });

    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toBe(false);
  });

  it('should get current user profile', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const token = regRes.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.email);
  });

  it('should update user profile', async () => {
    const regRes = await request(app).post('/api/auth/register').send(testUser);
    const token = regRes.body.data.token;

    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'UpdatedName',
        lastName: 'User',
        phone: '+254712345678'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.first_name).toBe('UpdatedName');
  });

  it('should not allow access without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toEqual(401);
  });
});

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
