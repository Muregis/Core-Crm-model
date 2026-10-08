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
- Communication and task hooks
- Optional background workers (`npm run worker`) via BullMQ + Redis

## Architecture

```
React (Vite)  ──REST──▶  Express API  ──▶  MySQL
                              │
                              ├── JWT + bcrypt + Helmet + rate limit
                              └── BullMQ workers (optional Redis)
```

| Layer | Choices |
|-------|---------|
| Frontend | React 18, Vite, Tailwind, React Router |
| API | Node.js, Express, Joi / express-validator |
| Auth | JWT, bcrypt, role checks |
| Data | MySQL 8 (schema under `database/`) |
| Jobs | BullMQ + Redis (worker entry: `backend/workers`) |
| Ops | Docker Compose, Winston logging |

## Key engineering decisions

1. **MySQL relational model** — customers, leads, deals, pipeline stages, M-Pesa transactions, communications, tasks, attachments, audit-oriented tables.
2. **Kenyan localization in the schema** — counties / sub-counties, KES, M-Pesa as first-class concepts.
3. **Workers as a separate process** — long-running work off the request path.
4. **Security baseline** — Helmet, rate limiting, JWT, bcrypt; secrets via environment only.

## Security

- Never commit `.env` — copy from `backend/.env.example`
- Rotate any credential that ever appeared in Git history
- Production: strong `JWT_SECRET`, HTTPS, least-privilege DB user

## Testing & CI

```bash
cd backend
npm test
```

GitHub Actions runs install + tests on PRs to `main`.

| Case | Expected |
|------|----------|
| Empty / malformed login body | 400 |
| Invalid credentials | 400/401 |
| `GET /api/auth/me` without token | 401 |
| Garbage Bearer token | 401 |
| Unauthenticated `GET /api/leads`, `/customers`, `/deals`, `/jobs`, `/tasks` | 401 |
| `GET /health` | 200 or 503 with services payload |

Next: seed test users for RBAC 403 cases and lead create 201; finish one BullMQ report workflow with job state tests.

## Quick start

**Prerequisites:** Node.js 18+, MySQL 8+

```bash
mysql -u root -p -e "CREATE DATABASE kenya_crm;"
mysql -u root -p kenya_crm < database/schema.sql
mysql -u root -p kenya_crm < database/seed_data.sql

cd backend && cp .env.example .env
npm install && npm run dev           # :5000

cd ../frontend && cp .env.example .env
npm install && npm run dev           # :5173
```

Optional worker (requires Redis):

```bash
cd backend && npm run worker
```

## Status

Active development. Auth integration tests are on branch `test/crm-integration-suite`.

## License

MIT (if present in repo).

---

Built by **Victor Muregi** for Kenyan business contexts.
