#!/bin/bash

# Kenya CRM Setup Script
# This script automates the setup process for Kenya CRM

set -e

echo "🇰🇪 Welcome to Kenya CRM Setup"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if Node.js is installed
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_VERSION="16.0.0"
        
        if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
            print_success "Node.js $NODE_VERSION found"
        else
            print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 16 or higher"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 16 or higher"
        exit 1
    fi
}

# Check if MySQL is installed
check_mysql() {
    if command -v mysql &> /dev/null; then
        print_success "MySQL found"
    else
        print_error "MySQL is not installed. Please install MySQL 8.0 or higher"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    if command -v npm &> /dev/null; then
        print_success "npm found"
    else
        print_error "npm is not installed"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing backend dependencies..."
    cd backend
    npm install
    print_success "Backend dependencies installed"
    
    print_info "Installing frontend dependencies..."
    cd ../frontend
    npm install
    print_success "Frontend dependencies installed"
    cd ..
}

# Setup database
setup_database() {
    print_info "Setting up database..."
    
    # Prompt for database credentials
    echo "Please enter your MySQL root password:"
    read -s MYSQL_ROOT_PASSWORD
    
    echo "Creating database and user..."
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS kenya_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'crm_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON kenya_crm.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    if [ $? -eq 0 ]; then
        print_success "Database and user created"
    else
        print_error "Failed to create database. Please check your MySQL credentials."
        exit 1
    fi
    
    echo "Importing database schema..."
    mysql -u crm_user -p'secure_password' kenya_crm < database/schema.sql
    
    echo "Importing sample data..."
    mysql -u crm_user -p'secure_password' kenya_crm < database/seed_data.sql
    
    print_success "Database setup completed"
}

# Setup environment files
setup_environment() {
    print_info "Setting up environment files..."
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_success "Backend .env file created"
        print_warning "Please edit backend/.env with your database credentials"
    else
        print_warning "Backend .env file already exists"
    fi
    
    # Frontend environment
    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        print_success "Frontend .env file created"
    else
        print_warning "Frontend .env file already exists"
    fi
}

# Create logs directory
create_logs() {
    print_info "Creating logs directory..."
    mkdir -p backend/logs
    print_success "Logs directory created"
}

# Main setup function
main() {
    echo "Checking prerequisites..."
    check_nodejs
    check_mysql
    check_npm
    
    echo ""
    print_info "Installing dependencies..."
    install_dependencies
    
    echo ""
    print_info "Setting up environment..."
    setup_environment
    
    echo ""
    print_info "Creating necessary directories..."
    create_logs
    
    echo ""
    read -p "Do you want to set up the database now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_database
    else
        print_warning "Database setup skipped. Please run it manually later."
    fi
    
    echo ""
    print_success "Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Edit backend/.env with your database credentials"
    echo "2. Start the backend server: cd backend && npm run dev"
    echo "3. Start the frontend server: cd frontend && npm run dev"
    echo "4. Open http://localhost:5173 in your browser"
    echo "5. Login with: admin@kenyacrm.com / admin123"
    echo ""
    echo "🇰🇪 Kenya CRM is ready to use!"
}

# Run main function
main
