const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const customerRoutes = require('./src/routes/customers');
const leadRoutes = require('./src/routes/leads');
const dealRoutes = require('./src/routes/deals');
const mpesaRoutes = require('./src/routes/mpesa');
const communicationRoutes = require('./src/routes/communications');
const taskRoutes = require('./src/routes/tasks');
const analyticsRoutes = require('./src/routes/analytics');
const countyRoutes = require('./src/routes/counties');
const uploadRoutes = require('./src/routes/uploads');
const jobsRoutes = require('./src/routes/jobs');
const reportsRoutes = require('./src/routes/reports');
const parcelRoutes = require('./src/routes/parcels');
const matterRoutes = require('./src/routes/matters');

const db = require('./src/config/database');
const { resolveTenant } = require('./src/middleware/tenant');

const app = express();

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Tenant resolution from subdomain / headers / token
app.use(resolveTenant);

// Static files (single registration)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  next();
});

app.get('/health', async (req, res) => {
  let dbHealthy = false;
  let redisHealthy = false;

  try {
    await db.query('SELECT 1');
    dbHealthy = true;
  } catch (e) {
    logger.error('DB Healthcheck failed', e);
  }

  try {
    const { emailQueue } = require('./src/queue/queues');
    const client = await emailQueue.client;
    if (client && typeof client.ping === 'function') {
      await client.ping();
      }
    redisHealthy = true;
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error('Redis Healthcheck failed', e);
    }
  }

  const ok = dbHealthy && (redisHealthy || process.env.NODE_ENV === 'test');
  res.status(ok ? 200 : 503).json({
    status: ok ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.NODE_ENV === 'production' ? 'MySQL' : 'SQLite',
    services: {
      api: 'healthy',
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/counties', countyRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/matters', matterRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use(errorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    logger.info(`Database: ${process.env.NODE_ENV === 'production' ? 'MySQL' : 'SQLite'}`);
  });
}

module.exports = app;
