const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (process.env.NODE_ENV === 'test') return null;
    if (times > 3) {
      logger.warn('Redis connection inactive. Queues running in local fallback mode.');
      return null;
    }
    logger.warn(`Redis retry connection attempt ${times}`);
    return Math.min(times * 100, 1000);
  }
};

const connection = new Redis(redisConfig);

connection.on('connect', () => {
  logger.info('Successfully connected to Redis');
});

connection.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

module.exports = connection;
