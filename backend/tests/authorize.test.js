/**
 * Pure unit tests for RBAC authorize() — no DB or Redis required.
 */
const { authorize } = require('../src/middleware/auth');

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

describe('authorize middleware', () => {
  test('returns 401 when req.user is missing', () => {
    const req = {};
    const res = mockRes();
    let nextCalled = false;
    authorize('admin')(req, res, () => {
      nextCalled = true;
    });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test('returns 403 when role is not allowed', () => {
    const req = { user: { id: 1, role: 'sales_rep' } };
    const res = mockRes();
    let nextCalled = false;
    authorize('admin', 'manager')(req, res, () => {
      nextCalled = true;
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(nextCalled).toBe(false);
  });

  test('calls next when role is allowed (manager)', () => {
    const req = { user: { id: 2, role: 'manager' } };
    const res = mockRes();
    let nextCalled = false;
    authorize('admin', 'manager')(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  test('calls next when role is allowed (admin)', () => {
    const req = { user: { id: 3, role: 'admin' } };
    const res = mockRes();
    let nextCalled = false;
    authorize('admin')(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
