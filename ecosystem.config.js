/**
 * PM2 Process Supervisor Configuration
 * Sawa Repairs / Core CRM Production Stack
 * 
 * Manages:
 * 1. core-crm-api: Express REST API & Webhook endpoints
 * 2. core-crm-worker: BullMQ background queue workers (email, reports, import, ticket reminders)
 */

module.exports = {
  apps: [
    {
      name: 'core-crm-api',
      script: './backend/server.js',
      cwd: __dirname,
      instances: 1, // Scalable to 'max' behind reverse proxy if session storage is stateless
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './backend/logs/pm2-api-error.log',
      out_file: './backend/logs/pm2-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'core-crm-worker',
      script: './backend/workers/worker.js',
      cwd: __dirname,
      instances: 1, // Singleton worker to prevent duplicate scheduled jobs
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 5000,
      min_uptime: '15s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './backend/logs/pm2-worker-error.log',
      out_file: './backend/logs/pm2-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
