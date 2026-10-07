# Kenya CRM - Customer Relationship Management Platform

A production-grade CRM platform specifically designed for the Kenyan market, featuring M-Pesa integration, county-based segmentation, and localized business workflows.

## 🌟 Key Features

- **Kenyan Market Focus**: County-based customer segmentation, KES currency, M-Pesa integration
- **Modern Tech Stack**: React (Vite) + Node.js + MySQL
- **Mobile-First Design**: Responsive interface optimized for Kenyan users
- **Advanced Analytics**: Sales dashboards, revenue tracking, conversion metrics
- **Role-Based Access**: Admin, Sales Rep, Manager roles with JWT authentication
- **Communication Hub**: WhatsApp integration, SMS logging, email tracking
- **SACCO/SME Features**: Group customer management, bulk operations

## 🚀 Tech Stack

### Frontend
- **React 18** with Vite
- **TailwindCSS** for modern, colorful UI
- **React Router** for navigation
- **Chart.js/Recharts** for analytics
- **Lucide Icons** for professional icons
- **Axios** for API calls

### Backend
- **Node.js** with Express.js
- **JWT Authentication** with bcrypt
- **MySQL** database
- **Multer** for file uploads
- **CORS** enabled
- **Winston** for logging

### Database
- **MySQL 8.0+**
- Optimized relational schema
- Proper indexing for performance
- County and region data

## 📁 Project Structure

```
kenya-crm/
├── frontend/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service functions
│   │   ├── utils/          # Utility functions
│   │   └── styles/         # Global styles
│   ├── package.json
│   └── vite.config.js
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utility functions
│   │   └── config/         # Configuration files
│   ├── package.json
│   └── server.js
├── database/               # Database schema and migrations
│   ├── schema.sql
│   ├── seed_data.sql
│   └── migrations/
└── docs/                   # Documentation
    ├── API.md
    ├── SETUP.md
    └── DEPLOYMENT.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ 
- MySQL 8.0+
- Git

### Quick Start

1. **Clone and setup**
   ```bash
   cd kenya-crm
   npm run setup
   ```

2. **Database Setup**
   ```bash
   # Create database and user
   mysql -u root -p
   CREATE DATABASE kenya_crm;
   CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON kenya_crm.* TO 'crm_user'@'localhost';
   FLUSH PRIVILEGES;
   
   # Import schema
   mysql -u crm_user -p kenya_crm < database/schema.sql
   mysql -u crm_user -p kenya_crm < database/seed_data.sql
   ```

3. **Environment Configuration**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   
   # Frontend  
   cd ../frontend
   cp .env.example .env
   ```

4. **Start Development Servers**
   ```bash
   # Backend (port 5000)
   cd backend
   npm run dev
   
   # Frontend (port 5173) - in new terminal
   cd frontend
   npm run dev
   ```

## 🌐 Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Default Admin**: admin@kenyacrm.com / admin123

## 📊 Core Modules

### 1. Authentication System
- JWT-based secure authentication
- Role-based access control (Admin, Sales Rep, Manager)
- Password encryption with bcrypt
- Session management

### 2. Customer Management
- Complete customer profiles
- County/sub-county location tracking
- Business categorization
- Customer segmentation and tagging
- Activity timeline

### 3. Lead Management
- Lead capture and scoring
- Pipeline stage tracking
- Conversion analytics
- Notes and attachments

### 4. Sales Pipeline
- Visual Kanban board
- Deal stage management
- Revenue forecasting
- Performance metrics

### 5. M-Pesa Integration
- Transaction tracking
- Payment status updates
- Revenue dashboard
- Transaction history

### 6. Communication Hub
- WhatsApp contact integration
- SMS logging system
- Email history tracking
- Interaction notes

### 7. Task Management
- Sales task creation
- Follow-up reminders
- Activity notifications
- Calendar integration

### 8. Analytics Dashboard
- Sales performance charts
- Customer growth metrics
- Revenue analytics
- Conversion tracking

## 🎨 UI Features

- **Modern Design**: Colorful, professional SaaS interface
- **Dark/Light Mode**: User preference support
- **Responsive**: Mobile-first design
- **Animations**: Smooth transitions and micro-interactions
- **Charts**: Interactive data visualizations

## 🌍 Kenyan Localization

- **Counties**: All 47 Kenyan counties with sub-counties
- **Currency**: Kenyan Shilling (KES) formatting
- **Date Formats**: DD/MM/YYYY format
- **Language**: Optional Kiswahili labels
- **Business Context**: Tailored for Kenyan business practices

## 🔒 Security Features

- JWT token authentication
- Password hashing with bcrypt
- CORS protection
- Input validation and sanitization
- SQL injection prevention
- Rate limiting

## 📱 Mobile Optimization

- Responsive design for all screen sizes
- Touch-friendly interface
- Offline capability with sync
- Progressive Web App (PWA) ready

## 🚀 Production Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Traditional Deployment
- Backend: PM2 process manager
- Frontend: Nginx static serving
- Database: MySQL server
- SSL: Let's Encrypt certificates

## 📈 Performance

- **Database**: Optimized queries with proper indexing
- **Frontend**: Code splitting and lazy loading
- **Caching**: Redis for session and data caching
- **CDN**: Asset delivery optimization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Email: muregivictor@gmail.com
- Documentation: /docs
- Issues: GitHub Issues

## 🔄 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting
- [ ] API integrations
- [ ] Multi-tenant support
- [ ] AI-powered insights
- [ ] Advanced automation workflows

---

Built with ❤️ for Kenyan businesses
