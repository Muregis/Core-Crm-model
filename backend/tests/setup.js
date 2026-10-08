process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-not-for-production';
process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
// Avoid hanging on Redis during unit/integration tests unless explicitly enabled
process.env.REDIS_URL = process.env.REDIS_URL || '';
