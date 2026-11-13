# Sawa Repairs & Core CRM: Production Operations Runbook

This runbook defines operational standards, process supervision, backup routines, queue resilience, M-Pesa reconciliation, and disaster recovery procedures for running Sawa Repairs and Core CRM in production.

---

## 1. Process Supervision & Auto-Restart (PM2)

Production environments run two managed Node.js services supervised by PM2 via `ecosystem.config.js`:
1. **`core-crm-api`**: Express REST API, public portals, webhooks, and M-Pesa Daraja callback listeners.
2. **`core-crm-worker`**: BullMQ background workers processing email dispatch, report rendering, CSV imports, and ticket reminder jobs.

### Process Lifecycle Commands
```bash
# Start all processes in production mode
pm2 start ecosystem.config.js --env production

# Check cluster and worker health
pm2 status
pm2 describe core-crm-api
pm2 describe core-crm-worker

# View unified or process-specific logs
pm2 logs
pm2 logs core-crm-api --lines 100
pm2 logs core-crm-worker --lines 100

# Zero-downtime reload for API updates
pm2 reload core-crm-api

# Restart background worker (drains active jobs safely via graceful SIGTERM)
pm2 restart core-crm-worker

# Save PM2 state to survive server reboots
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### Auto-Restart & Memory Threshold Rules
- **Memory Ceiling**: If `core-crm-api` exceeds 500MB or `core-crm-worker` exceeds 300MB, PM2 automatically restarts the process to prevent memory leaks from starving the host OS.
- **Flapping Prevention**: `min_uptime: '10s'` and `max_restarts: 10` prevent aggressive crash loops if database credentials fail.
- **Graceful Shutdown**: On `SIGTERM` or `SIGINT`, workers stop picking up new jobs, wait for in-flight tasks to complete, close active database handles, and exit cleanly with code 0.

---

## 2. Automated MySQL Daily Backups & 30-Day Rotation

Multi-tenant CRM data and audit trails require automated daily point-in-time backups.

### Automated Backup Script (`/usr/local/bin/backup-mysql.sh`)
```bash
#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/mysql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-core_crm_prod}"
DB_USER="${DB_USER:-crm_backup_user}"
DB_PASS="${DB_PASSWORD:-YourSecurePassword}"
RETENTION_DAYS=30
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://sawa-crm-database-backups/mysql}"

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting MySQL backup for ${DB_NAME}..."

# Execute consistent dump with single transaction
mysqldump \
  --user="${DB_USER}" \
  --password="${DB_PASS}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"

echo "[$(date)] Backup completed: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Verify gzip archive integrity
gzip -t "${BACKUP_FILE}"
echo "[$(date)] Archive integrity verified."

# Sync to offsite encrypted cloud storage (AWS S3 or Google Cloud Storage)
if command -v aws &> /dev/null; then
  aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/" --sse AES256
  echo "[$(date)] Offsite sync to ${S3_BUCKET} completed."
fi

# Purge local backups older than 30 days
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Purged local backups older than ${RETENTION_DAYS} days."
```

### Scheduled Cron Job
Add to `/etc/cron.d/crm-backup`:
```cron
# Run daily at 02:00 EAT (Nairobi Time)
0 2 * * * root /usr/local/bin/backup-mysql.sh >> /var/log/mysql-backup.log 2>&1
```

### Database Restoration Procedure
To restore from a backup:
```bash
# 1. Unpack and stream directly to MySQL
gunzip < /var/backups/mysql/core_crm_prod_YYYYMMDD_HHMMSS.sql.gz | mysql -u root -p core_crm_prod

# 2. Run pending migrations if restoring an older snapshot
cd /var/www/core-crm/backend
npm run migrate
```

---

## 3. Redis Connection Recovery & BullMQ Queue Supervision

BullMQ coordinates asynchronous background workloads. Redis must be configured for queue durability.

### Redis Server Configuration (`/etc/redis/redis.conf`)
```conf
# Prevent Redis from evicting queue jobs when memory is stressed
maxmemory-policy noeviction

# Enable Append-Only File (AOF) for point-in-time queue durability
appendonly yes
appendfsync everysec

# Standard RDB snapshots
save 900 1
save 300 10
save 60 10000
```

### Redis Recovery & Queue Health Checks
```bash
# Verify Redis responsiveness
redis-cli ping
# Output: PONG

# Inspect memory and connection stats
redis-cli info memory
redis-cli info clients

# Monitor BullMQ queue lengths
redis-cli keys "bull:*"
redis-cli llen "bull:ticket:wait"
redis-cli llen "bull:ticket:active"
redis-cli zcard "bull:ticket:delayed"
redis-cli zcard "bull:ticket:failed"
```

### Stalled Job Handling
BullMQ workers automatically monitor stalled jobs (lock renewal timeouts):
- If a Node worker process crashes mid-job, BullMQ re-queues the task after `stalledInterval` (default 30 seconds).
- Failed jobs remain in the `failed` set with error stack traces and can be inspected or re-tried via `queue.getFailed()`.

---

## 4. M-Pesa Daraja Configuration & Daily Till Reconciliation

Sawa Repairs supports M-Pesa Express (STK Push) for instant settlement of callout fees, repair quotes, and monthly maintenance statements.

### Environment Variable Checklist (`.env`)
```env
# Daraja Environment (sandbox | production)
MPESA_ENVIRONMENT=production

# Safaricom Daraja Portal Credentials
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret

# Business Shortcode (Paybill or Buy Goods Till Number)
MPESA_SHORTCODE=303030
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919

# Public Webhook / Callback Endpoint (Must be valid HTTPS)
MPESA_CALLBACK_URL=https://api.sawarepairs.com/api/mpesa/callback
```

### Safaricom Production Whitelisting
1. Ensure your domain runs TLS 1.2+ with a CA-signed SSL certificate (Let's Encrypt / DigiCert).
2. Register callback URLs via Safaricom Daraja Portal.
3. Whitelist Safaricom IP ranges on your host firewall (UFW / AWS Security Group):
   - `196.201.214.200` to `196.201.214.206`
   - `196.201.213.114`

### Daily Till / Statement Reconciliation
The `mpesa_transactions` table records every incoming STK push and callback result.

Run daily reconciliation query:
```sql
SELECT 
    DATE(created_at) AS transaction_date,
    status,
    COUNT(*) AS total_transactions,
    SUM(amount) AS total_volume_kes
FROM mpesa_transactions
WHERE created_at >= NOW() - INTERVAL 24 HOUR
GROUP BY DATE(created_at), status;
```

Compare `total_volume_kes` for `status = 'completed'` with Safaricom M-Pesa Organization Portal statement export:
- Any transaction stuck in `pending` longer than 15 minutes should trigger an automated status query (`/mpesa/transactionstatus/v1/query`).
- When payment is received for a ticket, `callout_fee_kes` is automatically waived on subsequent labour billing.

---

## 5. Winston Logger & Sentry Alerting

### Winston Log Management
Application logs are written to:
- `backend/logs/error.log` (level `error`)
- `backend/logs/combined.log` (all levels)

Configure `logrotate` (`/etc/logrotate.d/core-crm`):
```text
/var/www/core-crm/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
}
```

### Sentry Error Tracking Setup
In production, initialize Sentry in `backend/server.js` and `backend/workers/worker.js`:
```javascript
const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
```

### Critical Operational Alert Conditions
Trigger high-priority alerts (via Slack/Email/PagerDuty) when:
1. **SLA Breach**: Unassigned emergency ticket > 4 hours old.
2. **Payment Failure**: Repeated M-Pesa callback failures (HTTP 500 from Daraja).
3. **Queue Stalls**: BullMQ `failed` jobs count exceeds 10 in a rolling 1-hour window.
4. **Database Disk Usage**: Root or MySQL partition exceeds 80% capacity.
