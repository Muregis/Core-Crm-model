# Kenya CRM Setup Guide

This guide will help you set up the Kenya CRM platform on your local machine for development and testing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 16 or higher)
- **MySQL** (version 8.0 or higher)
- **Git**
- **npm** or **yarn** package manager

## Quick Setup (5 minutes)

### 1. Clone and Install Dependencies

```bash
# Navigate to the project directory
cd kenya-crm

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create database and user (run as MySQL root)
mysql -u root -p

# In MySQL console:
CREATE DATABASE kenya_crm;
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON kenya_crm.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import database schema and sample data
mysql -u crm_user -p kenya_crm < ../database/schema.sql
mysql -u crm_user -p kenya_crm < ../database/seed_data.sql
```

### 3. Environment Configuration

```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Frontend environment
cd ../frontend
cp .env.example .env
# Edit .env if needed (defaults should work for local development)
```

### 4. Start Development Servers

```bash
# Start backend (in one terminal)
cd backend
npm run dev

# Start frontend (in another terminal)
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Default Admin Login**: admin@kenyacrm.com / admin123

## Detailed Setup Instructions

### Database Configuration

1. **Install MySQL** if not already installed:
   - **Windows**: Download from [mysql.com](https://dev.mysql.com/downloads/mysql/)
   - **macOS**: `brew install mysql`
   - **Ubuntu**: `sudo apt-get install mysql-server`

2. **Start MySQL Service**:
   - **Windows**: Start via Services or `net start mysql`
   - **macOS**: `brew services start mysql`
   - **Linux**: `sudo systemctl start mysql`

3. **Secure MySQL** (recommended for production):
   ```bash
   mysql_secure_installation
   ```

4. **Create Database**:
   ```sql
   CREATE DATABASE kenya_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### Backend Configuration

1. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment Variables**:
   Create `.env` file in backend directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=crm_user
   DB_PASSWORD=your_secure_password
   DB_NAME=kenya_crm

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRES_IN=8h

   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # CORS Configuration
   FRONTEND_URL=http://localhost:5173
   ```

3. **Test Backend**:
   ```bash
   npm run dev
   # Should see: "Server running on port 5000"
   ```

### Frontend Configuration

1. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Variables**:
   Create `.env` file in frontend directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_APP_NAME=Kenya CRM
   VITE_APP_VERSION=1.0.0
   ```

3. **Test Frontend**:
   ```bash
   npm run dev
   # Should see: "Local: http://localhost:5173"
   ```

## Database Schema Overview

The Kenya CRM uses a comprehensive MySQL database with the following key tables:

### Core Tables
- **users**: Authentication and user management
- **customers**: Customer profiles and information
- **leads**: Lead management and tracking
- **deals**: Sales pipeline and deal tracking
- **mpesa_transactions**: M-Pesa payment integration

### Reference Tables
- **counties**: Kenyan counties (47 counties)
- **sub_counties**: Sub-counties within each county
- **business_categories**: Business categorization
- **customer_tags**: Customer segmentation tags
- **deal_stages**: Sales pipeline stages

### Supporting Tables
- **communications**: Call, email, SMS, WhatsApp logs
- **tasks**: Tasks and follow-ups
- **attachments**: File attachments
- **activity_log**: Audit trail
- **system_settings**: Configuration settings

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Other Modules
- `/api/leads` - Lead management
- `/api/deals` - Deal pipeline
- `/api/mpesa` - M-Pesa transactions
- `/api/communications` - Communication logs
- `/api/tasks` - Task management
- `/api/analytics` - Analytics and reports
- `/api/counties` - County data
- `/api/uploads` - File uploads

## Development Features

### Hot Reload
- Backend: Automatic restart on file changes (nodemon)
- Frontend: Instant hot module replacement (Vite)

### Logging
- Backend logs stored in `backend/logs/`
- Console logging in development mode

### Error Handling
- Comprehensive error handling with proper HTTP status codes
- User-friendly error messages
- Request/response logging

### Security Features
- JWT authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- Input validation

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL service is running
   - Verify database credentials in `.env`
   - Ensure database and user exist

2. **Port Already in Use**
   - Change port in `.env` file
   - Kill process using the port: `npx kill-port 5000`

3. **CORS Error**
   - Verify `FRONTEND_URL` in backend `.env`
   - Check frontend is running on correct port

4. **Module Not Found**
   - Run `npm install` in both frontend and backend
   - Clear node_modules and reinstall if needed

5. **Authentication Issues**
   - Check JWT secret is set in backend `.env`
   - Verify token expiration settings

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Support

If you encounter issues during setup:

1. Check the troubleshooting section above
2. Review the logs in `backend/logs/`
3. Verify all environment variables are set correctly
4. Ensure database schema is imported correctly

## Next Steps

After successful setup:

1. **Explore the Dashboard**: Navigate through different sections
2. **Add Sample Data**: Create test customers, leads, and deals
3. **Test Features**: Try customer management, lead tracking, etc.
4. **Review API Documentation**: Test API endpoints with Postman
5. **Customize**: Modify themes, add custom fields, etc.

## Development Tips

- Use the demo account for initial testing
- Database seed data includes sample customers and transactions
- API endpoints return structured JSON responses
- Frontend uses React Query for data fetching
- State management with Zustand
- Responsive design works on mobile devices

Happy coding! 🚀
