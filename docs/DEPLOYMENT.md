# Kenya CRM Deployment Guide

This guide covers various deployment options for the Kenya CRM platform in production environments.

## Production Deployment Options

### 1. Traditional Server Deployment

#### Prerequisites
- Ubuntu 20.04+ / CentOS 8+ / Windows Server
- Node.js 16+
- MySQL 8.0+
- Nginx (recommended)
- SSL certificate

#### Backend Deployment

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2

# Clone and setup
git clone <your-repo-url>
cd kenya-crm/backend
npm ci --production

# Configure production environment
cp .env.example .env
# Edit .env with production settings

# Start with PM2
pm2 start server.js --name kenya-crm-api
pm2 save
pm2 startup
```

#### Frontend Deployment

```bash
cd frontend
npm ci
npm run build

# Copy build files to Nginx
sudo cp -r dist/* /var/www/kenya-crm/
```

#### Nginx Configuration

Create `/etc/nginx/sites-available/kenya-crm`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Frontend
    location / {
        root /var/www/kenya-crm;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/kenya-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Docker Deployment

#### Docker Compose Setup

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: kenya_crm
      MYSQL_USER: crm_user
      MYSQL_PASSWORD: secure_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/1-schema.sql
      - ./database/seed_data.sql:/docker-entrypoint-initdb.d/2-seed.sql
    ports:
      - "3306:3306"

  backend:
    build: ./backend
    environment:
      DB_HOST: mysql
      DB_USER: crm_user
      DB_PASSWORD: secure_password
      DB_NAME: kenya_crm
      JWT_SECRET: your_production_jwt_secret
      NODE_ENV: production
    depends_on:
      - mysql
    ports:
      - "5000:5000"

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mysql_data:
```

#### Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

#### Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Cloud Platform Deployment

#### Heroku

Backend (`Procfile`):
```
web: npm start
```

Frontend (`Procfile`):
```
web: npm run start
```

Deploy commands:
```bash
# Backend
heroku create kenya-crm-api
heroku config:set NODE_ENV=production
heroku config:set DB_HOST=your-db-host
git subtree push --prefix backend heroku main

# Frontend
heroku create kenya-crm-frontend
git subtree push --prefix frontend heroku main
```

#### AWS (Elastic Beanstalk)

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init kenya-crm

# Deploy
eb create production
eb deploy
```

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure environment variables
3. Set build commands:
   - Backend: `npm install`
   - Frontend: `npm install && npm run build`
4. Set start commands:
   - Backend: `npm start`
   - Frontend: Serve static files with Nginx

## Database Configuration

### Production Database Setup

```sql
-- Create production database
CREATE DATABASE kenya_crm_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user with limited privileges
CREATE USER 'crm_prod'@'%' IDENTIFIED BY 'strong_production_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON kenya_crm_prod.* TO 'crm_prod'@'%';
FLUSH PRIVILEGES;

-- Import schema
mysql -u crm_prod -p kenya_crm_prod < database/schema.sql

-- Consider using production-specific seed data or migrate existing data
```

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_deals_customer_id ON deals(customer_id);
CREATE INDEX idx_mpesa_customer_id ON mpesa_transactions(customer_id);

-- Configure MySQL for production
-- In my.cnf:
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
```

## Security Configuration

### Environment Variables

Production `.env` should contain:

```env
# Database
DB_HOST=localhost
DB_USER=crm_prod
DB_PASSWORD=strong_production_password
DB_NAME=kenya_crm_prod

# JWT
JWT_SECRET=256-bit-random-string-here
JWT_EXPIRES_IN=8h

# Server
NODE_ENV=production
PORT=5000

# SSL
FRONTEND_URL=https://your-domain.com

# Logging
LOG_LEVEL=warn
LOG_FILE=/var/log/kenya-crm/app.log
```

### SSL/TLS Setup

#### Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Manual SSL

1. Purchase SSL certificate from provider
2. Upload certificate files to server
3. Configure Nginx with SSL paths

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# iptables rules
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -j DROP
```

## Monitoring and Logging

### Application Monitoring

```bash
# PM2 Monitoring
pm2 monit

# System monitoring
sudo apt-get install htop iotop
htop
iotop
```

### Log Management

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/kenya-crm

# Content:
/var/log/kenya-crm/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload kenya-crm-api
    endscript
}
```

### Health Checks

Add health check endpoint monitoring:

```bash
# Script to monitor API health
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)
if [ $response != "200" ]; then
    echo "API is down! Restarting..."
    pm2 restart kenya-crm-api
fi
```

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u crm_prod -p kenya_crm_prod > /backups/kenya_crm_$DATE.sql
find /backups -name "kenya_crm_*.sql" -mtime +7 -delete

# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

### File Backups

```bash
# Backup application files
tar -czf /backups/app_$(date +%Y%m%d).tar.gz /path/to/kenya-crm/
```

## Performance Optimization

### Backend Optimization

```javascript
// Enable compression in Express
const compression = require('compression');
app.use(compression());

// Configure connection pooling
const pool = mysql.createPool({
  connectionLimit: 20,
  queueLimit: 0,
  // ... other config
});

// Enable caching
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes
```

### Frontend Optimization

```javascript
// Enable gzip compression in Nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Browser caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or AWS ALB
2. **Multiple Backend Instances**: PM2 cluster mode
3. **Database Replication**: MySQL master-slave
4. **Redis Caching**: For session storage

### PM2 Cluster Mode

```bash
# Start with cluster mode
pm2 start server.js -i max --name kenya-crm-api

# Monitor cluster
pm2 monit
```

### Database Replication

```sql
-- Master configuration
server-id = 1
log-bin = mysql-bin
binlog-do-db = kenya_crm_prod

-- Slave configuration
server-id = 2
relay-log = mysql-relay
read-only = 1
```

## Troubleshooting Production Issues

### Common Problems

1. **High Memory Usage**
   - Monitor with `pm2 monit`
   - Check for memory leaks
   - Optimize database queries

2. **Database Connection Issues**
   - Check connection pool settings
   - Monitor active connections
   - Optimize slow queries

3. **SSL Certificate Issues**
   - Verify certificate validity
   - Check Nginx configuration
   - Renew certificates automatically

### Debug Commands

```bash
# Check application logs
pm2 logs kenya-crm-api

# Check system resources
free -h
df -h
top

# Check database status
mysql -u crm_prod -p -e "SHOW PROCESSLIST;"

# Test API endpoints
curl -I http://localhost:5000/health
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review logs, monitor performance
2. **Monthly**: Update dependencies, security patches
3. **Quarterly**: Database optimization, backup testing
4. **Annually**: SSL certificate renewal, security audit

### Update Process

```bash
# Backend update
cd backend
git pull origin main
npm ci --production
pm2 restart kenya-crm-api

# Frontend update
cd frontend
git pull origin main
npm ci
npm run build
sudo cp -r dist/* /var/www/kenya-crm/
sudo nginx -t && sudo systemctl reload nginx
```

This deployment guide should help you successfully deploy Kenya CRM in various production environments. Choose the deployment method that best fits your infrastructure and requirements.
