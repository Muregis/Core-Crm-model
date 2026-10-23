module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  clearMocks: true,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: false,
  verbose: true,
  forceExit: true,
  detectOpenHandles: false,
  testTimeout: 20000
};
