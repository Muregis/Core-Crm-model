module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 15000
};
