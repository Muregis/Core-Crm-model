const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// PII Masking format for Kenya Data Protection Act 2019 compliance
const maskPiiFormat = winston.format((info) => {
  const maskString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      // Mask Kenyan mobile numbers: +254 7XX XXX 789 -> +254 7XX *** *89
      .replace(/(\+?254|0)(7\d|1\d)\d{4}(\d{2})/g, '$1$2****$3')
      // Mask passwords or tokens in query/body strings
      .replace(/(password|token|secret|passkey)=([^\s&]+)/gi, '$1=******');
  };

  if (info.message) {
    info.message = maskString(info.message);
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    maskPiiFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'kenya-crm-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ]
});

// If we're not in production, log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
