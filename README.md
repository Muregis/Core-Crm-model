# Kenya CRM

CRM platform for Kenyan SMEs and SACCOs: customers, leads, pipeline, role-based access, and M-Pesa-oriented payment tracking with county-level localization.

## Problem

Many Kenyan SMEs and SACCOs still track customers and payments in spreadsheets or generic tools that ignore local realities: **47 counties**, **KES**, **M-Pesa**, and mixed field + office sales workflows.

## Solution

A focused CRM with:

- Customer and lead records with Kenyan location fields
- Sales pipeline stages and deal tracking
- JWT auth with role-based access (admin / manager / sales)
- M-Pesa-oriented transaction records
- **Async sales reports** via BullMQ (API enqueues → worker generates CSV → status/download)

## Architecture

```
                 ┌──────────────┐
                 │  React (Vite) │
                 └───────┬───────┘
                         │ REST
                 ┌───────▼───────┐
                 │  Express API  │
                 └───┬───────┬───┘
                     │       │
               MySQL │       │ BullMQ
                     │       ▼
                     │    Redis
                     │       │
                     │    Worker process
                     │    (npm run worker)
                     │       │
                     └──► reports CSV + job status
```

### Background report workflow

```
POST /api/reports  (admin/manager + JWT)
        ↓ 202 { jobId, status: queued }
   reportQueue (BullMQ) → Redis
        ↓
   report.worker.js
        ↓ CSV under uploads/reports/
GET /api/jobs/:id          → status (queued|active|completed|failed)
GET /api/jobs/:id/result   → download CSV or JSON summary
POST /api/jobs/report/:id/retry  → bounded retries (3, exponential backoff)
```

| Layer | Choices |
|-------|---------|
| Frontend | React 18, Vite, Tailwind |
| API | Node.js, Express |
| Auth | JWT, bcrypt, roles |
| Data | MySQL 8 |
| Jobs | BullMQ + Redis |
| Ops | Docker Compose, GitHub Actions |

## Security

- Never commit `.env` — copy from `backend/.env.example`
- Rotate any credential that ever appeared in Git history
- Production: strong `JWT_SECRET`, HTTPS, least-privilege DB user

## Testing & CI

```bash
cd backend && npm test
```

| Case | Expected |
|------|----------|
| Empty / malformed login | 400 |
| Invalid credentials | 400/401 |
| Protected routes without token | 401 |
| `POST /api/reports` without token | 401 |
| Report producer enqueue options | 3 attempts, exponential backoff |
| `GET /health` | 200 or 503 with services payload |

## Quick start

**Prerequisites:** Node.js 18+, MySQL 8+, Redis (for workers)

```bash
mysql -u root -p -e "CREATE DATABASE kenya_crm;"
mysql -u root -p kenya_crm < database/schema.sql
mysql -u root -p kenya_crm < database/seed_data.sql
# optional: database/migrations/002_jobs_result_columns.sql

cd backend && cp .env.example .env
npm install && npm run dev           # API :5000

# separate terminal — worker process
cd backend && npm run worker

cd ../frontend && npm install && npm run dev
```

Example report request (after login):

```bash
curl -X POST http://localhost:5000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType":"sales"}'
# → 202 { jobId }
# poll GET /api/jobs/:id then GET /api/jobs/:id/result
```

## Status

Active development. End-to-end BullMQ sales report path on `feat/bullmq-report-workflow`.

## License

MIT

---

Built by **Victor Muregi** for Kenyan business contexts.
