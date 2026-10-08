const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    logger.warn(`Redis retry connection attempt ${times}`);
    return Math.min(times * 50, 2000);
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
