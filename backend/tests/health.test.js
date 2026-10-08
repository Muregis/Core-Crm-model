/**
 * Baseline API smoke tests.
 * Expand with auth, leads, and RBAC cases as the suite grows.
 */
const request = require('supertest');

// Prefer exporting the Express app from server.js without listen() for tests.
// Until that refactor, this file documents the intended contract.
describe('Kenya CRM API contracts', () => {
  test('test harness is wired (jest + supertest available)', () => {
    expect(typeof request).toBe('function');
  });

  // Example target cases for the next iteration:
  // POST /api/auth/login → 400 without body
  // GET /api/leads without token → 401
  // POST /api/leads as sales role → 201 with valid payload
});
