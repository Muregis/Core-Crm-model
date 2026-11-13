# Core CRM

[![CI](https://github.com/Muregis/Core-Crm-model/actions/workflows/ci.yml/badge.svg)](https://github.com/Muregis/Core-Crm-model/actions/workflows/ci.yml)

Multi-tenant CRM and operations platform for Kenyan SMEs, SACCOs, and specialized vertical workflows (sales pipeline, real-estate parcels, commercial quoting/invoicing, legal matters).

Built for: **sales teams**, **land brokers**, **distributors**, and **small legal practices** that need tenant isolation, role-based access, M-Pesa-oriented payments, and background jobs — not another generic contacts spreadsheet.

---

## Problem

Kenyan SMEs and SACCOs often track customers, deals, and payments across WhatsApp, notebooks, and spreadsheets. That breaks down when you need:

- Shared pipeline visibility across a team
- County / KES / M-Pesa-native fields
- Clear roles (admin, manager, sales)
- Long-running reports without blocking the API
- Isolation between organizations on one deployment

## What ships today

| Area | Capabilities |
|------|----------------|
| **Core CRM** | Customers, leads, deals/pipeline, tasks, communications, county localization |
| **Auth & tenancy** | JWT + refresh flow, RBAC, `tenant_id` scoping, tenant registration |
| **Payments** | M-Pesa-oriented records and encrypted credential storage patterns |
| **Jobs** | BullMQ + Redis: enqueue reports → worker → status / result API |
| **Vertical modules** | Land parcels & installments, commercial quotes/invoices, legal matters & billable time, executive analytics |
| **Field Service (Sawa Repairs)** | Property maintenance tickets, trade categories, technician scheduling, landlord approvals, WhatsApp intake, SLA reminders |
| **Compliance hooks** | PII-aware logging patterns, export / anonymize endpoints (KDPA-oriented) |

> **Honest status:** Core CRM is under active product development. Vertical modules and analytics are implemented with automated tests; treat production rollout as phased (tenant onboarding, payment credentials, and ops monitoring still need operator setup).

---

## Architecture

```
React (Vite)  ──REST──▶  Express API  ──▶  MySQL (SQLite fallback in dev/test)
                              │
                              ├── JWT + RBAC + tenant guards
                              └── BullMQ ──▶ Redis ──▶ Worker process
```

| Layer | Choices |
|-------|---------|
| Frontend | React 18, Vite, Tailwind |
| API | Node.js, Express |
| Auth | JWT, bcrypt, role checks, refresh / blocklist patterns |
| Data | MySQL 8+ (SQLite fallback for local/CI) |
| Jobs | BullMQ + Redis |
| Ops | Docker Compose, GitHub Actions |

### Background report flow

```
POST /api/reports (or analytics report) → 202 { jobId }
        ↓
   BullMQ queue → Redis → worker
        ↓
GET /api/jobs/:id → status
GET /api/jobs/:id/result → payload / file when completed
```

---

## Service Ticket & Field-Service Module (Sawa Repairs)

Powers **Sawa Repairs** (ticket-based property maintenance for landlords, Airbnb hosts, and SMEs across Kenya).

### Core Capabilities

1. **Multi-Tenant Property Portfolio (`/api/properties`)**:
   - Manage properties and rental units linked to landlord customers.
   - Track unit counts, physical addresses, notes, and open ticket counts per property.
   - Enforce strict `tenant_id` isolation across all property listings and queries.

2. **Full Lifecycle Service Tickets (`/api/tickets`)**:
   - Human-readable ticket numbers (`SAW-YYYY-XXXXX`, e.g. `SAW-2026-00041`).
   - Categorized by trade: `plumbing`, `electrical`, `roofing`, `painting`, `general`, `solar`, `other`.
   - Prioritized by SLA: `emergency` (3h target), `standard`, `planned`.
   - Strict state machine lifecycle validation:
     `reported` ➔ `triaged` ➔ `scheduled` ➔ `in_progress` ➔ `awaiting_parts` ➔ `resolved` ➔ `verified` ➔ `closed` (with `reopened` rollback).
   - Auto-recorded audit trail in `ticket_status_history` and `activity_log`.

3. **Technician Assignment & Scheduling**:
   - Assign field technicians (`users` table) and set `scheduled_at`.
   - Automatically synchronizes with CRM `tasks` table (`task_type = 'field_service'`).
   - BullMQ worker sends daily digest of open tickets per technician.

4. **Landlord Approval & Cost Tracking**:
   - Set approval threshold (KES).
   - Flag approval requirements when estimated or actual repair costs (labour hours + parts) exceed threshold.
   - Record landlord approvals/rejections with audit notes and timestamps.
   - BullMQ reminder jobs for pending landlord approvals.

5. **WhatsApp-Friendly Intake Endpoint (`POST /api/tickets/whatsapp-intake`)**:
   - Accepts incoming structured payloads from WhatsApp bot/bridge:
     ```json
     {
       "tenant_id": 1,
       "propertyIdentifier": "Riverside Villa 4B",
       "category": "plumbing",
       "priority": "emergency",
       "description": "Burst pipe flooding the bathroom",
       "reportedBy": "Tenant John (+254712345678)",
       "unitNumber": "4B",
       "photoUrls": ["https://cdn.example.com/photos/burst_pipe.jpg"]
     }
     ```
   - Automatically matches or provisions property, attaches before/after photos into `attachments`, and creates a ticket in `reported` status.
   - Enqueues emergency SLA reminder job.

6. **Dashboard Stats (`GET /api/tickets/dashboard/stats`)**:
   - Real-time overview of open emergencies, SLA breaches, monthly ticket volume, total repair costs, and breakdown by category and status.

### API Quick Reference

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/properties` | List properties with landlord details & open ticket counts | Authenticated |
| `POST` | `/api/properties` | Create property | Authenticated |
| `GET` | `/api/properties/:id` | Get single property with details | Authenticated |
| `PATCH` | `/api/properties/:id` | Update property | Authenticated |
| `DELETE` | `/api/properties/:id` | Delete property | Admin / Manager |
| `GET` | `/api/tickets` | List tickets with filters (`property_id`, `status`, `category`, `priority`, `technician_id`, date range, search `q`) | Authenticated |
| `POST` | `/api/tickets` | Create service ticket (auto-generates `SAW-YYYY-XXXXX`) | Authenticated |
| `GET` | `/api/tickets/:id` | Get ticket with attachments, linked tasks & status history | Authenticated |
| `PATCH` | `/api/tickets/:id` | Update ticket details | Authenticated |
| `DELETE` | `/api/tickets/:id` | Delete ticket | Admin / Manager |
| `PATCH` | `/api/tickets/:id/status` | Transition ticket status with state machine validation | Authenticated |
| `POST` | `/api/tickets/:id/schedule` | Assign technician + schedule (syncs linked task) | Authenticated |
| `POST` | `/api/tickets/:id/approval` | Request or record landlord approval (`request`, `approve`, `reject`) | Authenticated |
| `POST` | `/api/tickets/:id/costs` | Record labour hours, parts cost, and total KES | Authenticated |
| `POST` | `/api/tickets/:id/attachments` | Add before/after repair photos or documents | Authenticated |
| `GET` | `/api/tickets/:id/attachments` | List ticket attachments | Authenticated |
| `GET` | `/api/tickets/dashboard/stats` | Dashboard metrics (open emergencies, SLA breaches, monthly counts) | Authenticated |
| `POST` | `/api/tickets/whatsapp-intake` | Webhook intake for WhatsApp chat bots | Public / Authenticated |

---

## Testing & CI

```bash
cd backend
npm ci
npm test
```

Automated suites cover authentication, customers, leads, deals, parcels, matters, jobs/reports, multi-tenant lifecycle, analytics, and RBAC middleware. GitHub Actions runs backend tests (Node 18 & 20 + Redis), frontend production build, and `docker compose config`.

CI **fails if no tests are discovered** (no `--passWithNoTests`).

> Run `npm test` locally after clone and treat the terminal summary as the source of truth for pass counts — not a static badge.

---

## Security notes

- Never commit `.env` — use `backend/.env.example`
- Rotate any secrets that ever appeared in Git history
- Production: strong `JWT_SECRET`, HTTPS, least-privilege DB user, tenant-scoped queries
- Payment credentials should be encrypted at rest; do not log full tokens or phone numbers in plaintext

---

## Quick start

**Prerequisites:** Node.js 18+, MySQL 8+ (or use SQLite fallback), Redis for workers

```bash
git clone https://github.com/Muregis/Core-Crm-model.git
cd Core-Crm-model/backend
npm ci
cp .env.example .env
npm run migrate   # if available
npm test
npm run dev       # API :5000

# optional worker
npm run worker

cd ../frontend && npm ci && npm run dev
```

Demo seed profiles (if migrations/seed applied) are documented in-repo for local exploration. Change passwords before any shared or public deployment.

---

## For employers & partners

**What to inspect first**

1. `backend/tests/` — isolation, auth, jobs
2. `backend/src/middleware/auth.js` + tenant-aware controllers
3. `backend/workers/` + `src/queue/` — async design
4. GitHub Actions on `main` — green CI

**Interview topics I’m ready for:** tenant isolation, RBAC 403 paths, BullMQ failure/retry, M-Pesa webhook idempotency patterns, trade-offs SQLite vs MySQL in test vs prod.

---

## License

MIT — see `LICENSE`.

---

Built by **Victor Muregi** · MuregiScore Technologies · Nairobi, Kenya
