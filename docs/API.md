# Kenya CRM API Documentation

## Overview

The Kenya CRM API is a RESTful API built with Node.js and Express.js. It provides endpoints for managing customers, leads, deals, payments, and other CRM functionalities.

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses JWT (JSON Web Token) authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors (if applicable)
}
```

## Authentication Endpoints

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+254712345678",
  "role": "sales_rep" // Optional: admin, manager, sales_rep
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "sales_rep"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get Current User
```http
GET /auth/me
```

**Headers:** `Authorization: Bearer <token>`

### Update Profile
```http
PUT /auth/profile
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+254712345678"
}
```

### Change Password
```http
PUT /auth/password
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

## Customer Endpoints

### Get Customers
```http
GET /customers
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search customers by name, email, phone, company
- `status` (string): Filter by status (active, inactive, prospect)
- `customerType` (string): Filter by type (individual, business, sacco, sme)
- `businessCategory` (string): Filter by business category
- `county` (string): Filter by county
- `salesRep` (string): Filter by sales representative
- `sortBy` (string): Sort field (created_at, first_name, etc.)
- `sortOrder` (string): Sort direction (ASC, DESC)

**Response:**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": 1,
        "firstName": "James",
        "lastName": "Mwangi",
        "email": "james@example.com",
        "phone": "+254712345690",
        "companyName": "Mwangi Enterprises",
        "customerType": "business",
        "status": "active",
        "countyName": "Nairobi",
        "businessCategory": "Technology",
        "salesRepName": "John Sales",
        "totalRevenue": 250000,
        "wonDealsCount": 3,
        "communicationsCount": 15,
        "transactionCount": 5,
        "createdAt": "2024-03-12T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

### Get Customer Details
```http
GET /customers/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 1,
      "firstName": "James",
      "lastName": "Mwangi",
      "email": "james@example.com",
      "phone": "+254712345690",
      "companyName": "Mwangi Enterprises",
      "customerType": "business",
      "status": "active",
      "physicalAddress": "Westlands, Nairobi",
      "countyName": "Nairobi",
      "subCountyName": "Westlands",
      "businessCategory": "Technology",
      "salesRepName": "John Sales",
      "notes": "Important customer",
      "createdAt": "2024-03-12T10:30:00Z",
      "tags": [
        {
          "id": 1,
          "name": "VIP",
          "color": "#ff6b6b"
        }
      ],
      "recentDeals": [...],
      "recentCommunications": [...],
      "recentTransactions": [...]
    }
  }
}
```

### Create Customer
```http
POST /customers
```

**Request Body:**
```json
{
  "firstName": "James",
  "lastName": "Mwangi",
  "email": "james@example.com",
  "phone": "+254712345690",
  "companyName": "Mwangi Enterprises",
  "businessCategoryId": 2,
  "countyId": 1,
  "subCountyId": 1,
  "physicalAddress": "Westlands, Nairobi",
  "customerType": "business",
  "status": "active",
  "notes": "Important customer",
  "assignedSalesRepId": 2,
  "tags": [1, 2]
}
```

### Update Customer
```http
PUT /customers/:id
```

**Request Body:** Same as create customer

### Delete Customer
```http
DELETE /customers/:id
```

## Lead Endpoints

### Get Leads
```http
GET /leads
```

**Query Parameters:** Similar to customers endpoint

### Create Lead
```http
POST /leads
```

**Request Body:**
```json
{
  "firstName": "Peter",
  "lastName": "Karanja",
  "email": "peter@example.com",
  "phone": "+254712345692",
  "companyName": "Karanja Tech",
  "source": "website",
  "status": "new",
  "priority": "medium",
  "score": 30,
  "estimatedValue": 150000,
  "countyId": 1,
  "businessCategoryId": 2,
  "assignedSalesRepId": 2,
  "notes": "Interested in CRM system"
}
```

### Convert Lead to Customer
```http
POST /leads/:id/convert
```

**Request Body:**
```json
{
  "customerData": {
    "firstName": "Peter",
    "lastName": "Karanja",
    // ... customer fields
  }
}
```

## Deal Endpoints

### Get Deals
```http
GET /deals
```

### Create Deal
```http
POST /deals
```

**Request Body:**
```json
{
  "title": "CRM Implementation",
  "customerId": 1,
  "dealStageId": 3,
  "assignedSalesRepId": 2,
  "value": 250000,
  "currency": "KES",
  "expectedCloseDate": "2024-04-15",
  "notes": "Full CRM implementation"
}
```

### Update Deal Stage
```http
PUT /deals/:id/stage
```

**Request Body:**
```json
{
  "stageId": 4
}
```

## M-Pesa Endpoints

### Get Transactions
```http
GET /mpesa
```

**Query Parameters:**
- `customerId` (number): Filter by customer
- `status` (string): Filter by status (pending, completed, failed)
- `startDate` (string): Filter by start date
- `endDate` (string): Filter by end date

### Create Transaction
```http
POST /mpesa
```

**Request Body:**
```json
{
  "customerId": 1,
  "dealId": 1,
  "amount": 50000,
  "phoneNumber": "+254712345690",
  "transactionType": "payment",
  "notes": "Initial payment"
}
```

### Check Transaction Status
```http
GET /mpesa/:transactionId/status
```

## Communication Endpoints

### Get Communications
```http
GET /communications
```

**Query Parameters:**
- `customerId` (number): Filter by customer
- `type` (string): Filter by type (call, email, sms, whatsapp)
- `startDate` (string): Filter by start date
- `endDate` (string): Filter by end date

### Create Communication
```http
POST /communications
```

**Request Body:**
```json
{
  "customerId": 1,
  "type": "call",
  "direction": "outbound",
  "subject": "Follow up call",
  "content": "Discussed CRM requirements",
  "durationMinutes": 15,
  "status": "completed",
  "nextFollowUp": "2024-03-15T10:00:00Z"
}
```

## Task Endpoints

### Get Tasks
```http
GET /tasks
```

**Query Parameters:**
- `assignedTo` (number): Filter by assigned user
- `status` (string): Filter by status (pending, in_progress, completed)
- `priority` (string): Filter by priority (low, medium, high, urgent)
- `dueDate` (string): Filter by due date

### Create Task
```http
POST /tasks
```

**Request Body:**
```json
{
  "title": "Follow up with customer",
  "description": "Discuss proposal details",
  "customerId": 1,
  "assignedTo": 2,
  "priority": "medium",
  "dueDate": "2024-03-15T10:00:00Z",
  "taskType": "follow_up"
}
```

## Analytics Endpoints

### Get Dashboard Stats
```http
GET /analytics/dashboard
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCustomers": 1234,
    "activeLeads": 89,
    "openDeals": 45,
    "monthlyRevenue": 2400000,
    "conversionRate": 25.5,
    "averageDealSize": 150000
  }
}
```

### Get Sales Performance
```http
GET /analytics/sales-performance
```

**Query Parameters:**
- `startDate` (string): Start date
- `endDate` (string): End date
- `groupBy` (string): Group by (day, week, month, year)

### Get Customer Growth
```http
GET /analytics/customer-growth
```

### Get Revenue Analytics
```http
GET /analytics/revenue
```

### Get Top Customers
```http
GET /analytics/top-customers
```

### Get Sales by County
```http
GET /analytics/sales-by-county
```

## County and Reference Data Endpoints

### Get Counties
```http
GET /counties
```

**Response:**
```json
{
  "success": true,
  "data": {
    "counties": [
      {
        "id": 1,
        "name": "Nairobi",
        "code": "NBI"
      }
    ]
  }
}
```

### Get Sub-Counties
```http
GET /counties/:countyId/sub-counties
```

### Get Business Categories
```http
GET /counties/business-categories
```

### Get Customer Tags
```http
GET /customers/tags
```

### Get Deal Stages
```http
GET /deals/stages
```

## File Upload Endpoints

### Upload File
```http
POST /uploads
```

**Content-Type:** `multipart/form-data`

**Request Body:**
- `file` (File): File to upload

**Response:**
```json
{
  "success": true,
  "data": {
    "filename": "generated_filename.jpg",
    "originalName": "original_filename.jpg",
    "size": 1024000,
    "path": "/uploads/generated_filename.jpg"
  }
}
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Pagination

All list endpoints support pagination with these parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

## Search and Filtering

Most list endpoints support:
- **Search**: Free text search across relevant fields
- **Filtering**: Filter by specific fields
- **Sorting**: Sort by any field with ASC/DESC direction

## Data Validation

All endpoints validate input data and return detailed error messages for invalid fields.

## Security Features

- JWT authentication with expiration
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- Input sanitization
- SQL injection prevention

## Testing the API

### Using curl

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kenyacrm.com","password":"admin123"}'

# Get customers
curl -X GET http://localhost:5000/api/customers \
  -H "Authorization: Bearer <token>"
```

### Using Postman

1. Import the API collection
2. Set base URL: `http://localhost:5000/api`
3. Configure authentication: Bearer Token
4. Use the login endpoint to get a token
5. Add token to authorization header for other requests

## SDK and Libraries

While not currently available, SDKs for popular languages can be generated from the OpenAPI specification.

## Support

For API support:
- Review this documentation
- Check the server logs for detailed error information
- Verify request format and authentication
- Test with the provided examples

This API documentation covers all current endpoints and will be updated as new features are added.
