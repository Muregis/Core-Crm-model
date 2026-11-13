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

1. **Multi-Tenant Property Portfolio & Maintenance Memory (`/api/properties`)**:
   - Manage properties and rental units linked to landlord customers.
   - Track unit counts, physical addresses, notes, and open ticket counts per property.
   - **Property Maintenance Memory (`GET /api/properties/:id/maintenance-memory`)**: Sawa's core competitive moat (Product Document v2.1 §3 & §11). Provides lifetime repair spend, category breakdown, active 30-day workmanship warranties, chronological repair timeline with before/after photos, property health score (0–100), and recurring failure detection (flags categories with >= 2 repairs in 90 days as preventive maintenance alerts).
   - **Landlord Monthly Consolidated Report (`GET /api/properties/landlord/:customerId/monthly-report`)**: Generates consolidated monthly statements for landlords/diaspora owners aggregating portfolio spend, labour vs parts vs callout fees, and tickets completed.

2. **Full Lifecycle Service Tickets (`/api/tickets`)**:
   - Human-readable ticket numbers (`SAW-YYYY-XXXXX`, e.g. `SAW-2026-00041`).
   - Categorized by trade: `plumbing`, `electrical`, `roofing`, `painting`, `general`, `solar`, `other`.
   - Prioritized by SLA: `emergency` (2–4h response SLA, default 3h timer), `standard` (24–48h), `planned` (3–5 working days).
   - Strict state machine lifecycle validation:
     `reported` ➔ `triaged` ➔ `scheduled` ➔ `in_progress` ➔ `awaiting_parts` ➔ `resolved` ➔ `verified` ➔ `closed` (with `reopened` rollback).
   - Automatic 30-day workmanship warranty attached upon resolution (`warranty_until = resolved_at + 30 days`).
   - Auto-recorded audit trail in `ticket_status_history` and `activity_log`.

3. **Unit Economics & Transparent Pricing Model (v2.1 §4.3 & §7.4)**:
   - Diagnostic / call-out fee tracking (KSh 1,500–2,500; automatically waived when customer approves repair).
   - Emergency callout premium (+30–50%).
   - Transparent parts billing: wholesale parts cost + 15–25% margin markup.
   - Internal technician labour cost vs billed labour rate.
   - Per-ticket profitability tracking: Gross Revenue (`invoice_amount_kes`), Direct COGS (`labour_cost_kes + parts_cost_kes + travel_cost_kes`), Gross Margin KES, and Margin %.

4. **Technician Assignment & Scheduling**:
   - Assign field technicians (`users` table) and set `scheduled_at`.
   - Automatically synchronizes with CRM `tasks` table (`task_type = 'field_service'`).
   - BullMQ worker sends daily digest of open tickets per technician.

5. **Landlord Approval Workflow & Repeat Customer Conversion (v2.1 §5 & §12)**:
   - Set approval threshold (KES).
   - Flag approval requirements when repair estimate exceeds threshold.
   - Record landlord approvals/rejections with audit notes and timestamps.
   - **Sawa Care Conversion Engine (`GET /api/tickets/sawa-care/eligible`)**: Automatically tracks repeat customers generating 3+ tickets in 90 days for conversion to Sawa Care managed contracts.
   - **Sawa Care Contracts Management (`/api/tickets/sawa-care/contracts`)**: Manages framework agreements (`home`, `portfolio`, `corporate` tiers) with locked discounted rates, priority SLA response, and scheduled quarterly preventive inspections.

6. **Executive Company Plan Scorecard (`GET /api/tickets/dashboard/company-plan`)**:
   - Tracks real-time progress against Sawa Repairs 90-day execution targets (Product Document v2.1 §12):
     - 50–100 completed tickets
     - 20–30 paying customers
     - 8–12 repeat customers (>= 3 tickets in 90d)
     - 5–10 Sawa Care managed contracts
     - Financials: Total Revenue, Total Direct COGS, Gross Margin KES, Margin %
     - Service Quality: Emergency SLA compliance %, SLA breach counts, 30-day warranty rework claim rate.

7. **WhatsApp-Friendly Intake Endpoint (`POST /api/tickets/whatsapp-intake`)**:
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

### API Quick Reference

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/properties` | List properties with landlord details & open ticket counts | Authenticated |
| `POST` | `/api/properties` | Create property | Authenticated |
| `GET` | `/api/properties/:id` | Get single property with details | Authenticated |
| `PATCH` | `/api/properties/:id` | Update property | Authenticated |
| `DELETE` | `/api/properties/:id` | Delete property | Admin / Manager |
| `GET` | `/api/properties/:id/maintenance-memory` | Get property maintenance memory, health score & recurring alerts | Authenticated |
| `GET` | `/api/properties/landlord/:customerId/monthly-report` | Landlord monthly consolidated portfolio statement | Authenticated |
| `GET` | `/api/tickets` | List tickets with filters (`property_id`, `status`, `category`, `priority`, `technician_id`, date range, search `q`) | Authenticated |
| `POST` | `/api/tickets` | Create service ticket (auto-generates `SAW-YYYY-XXXXX`, SLA response due date) | Authenticated |
| `GET` | `/api/tickets/:id` | Get ticket with attachments, linked tasks & status history | Authenticated |
| `PATCH` | `/api/tickets/:id` | Update ticket details | Authenticated |
| `DELETE` | `/api/tickets/:id` | Delete ticket | Admin / Manager |
| `PATCH` | `/api/tickets/:id/status` | Transition ticket status (with 30-day warranty & SLA breach checks) | Authenticated |
| `POST` | `/api/tickets/:id/schedule` | Assign technician + schedule (syncs linked task) | Authenticated |
| `POST` | `/api/tickets/:id/approval` | Request or record landlord approval (waives callout fee on approval) | Authenticated |
| `POST` | `/api/tickets/:id/costs` | Record labour, parts markup, callout, gross margin & margin % | Authenticated |
| `POST` | `/api/tickets/:id/attachments` | Add before/after repair photos or documents | Authenticated |
| `GET` | `/api/tickets/:id/attachments` | List ticket attachments | Authenticated |
| `GET` | `/api/tickets/dashboard/stats` | Dashboard metrics (open emergencies, SLA breaches, monthly counts) | Authenticated |
| `GET` | `/api/tickets/dashboard/company-plan` | Sawa Repairs 90-day targets scorecard & unit economics | Authenticated |
| `GET` | `/api/tickets/sawa-care/eligible` | List repeat customers qualified for Sawa Care (>=3 tickets in 90d) | Authenticated |
| `GET` | `/api/tickets/sawa-care/contracts` | List Sawa Care managed contracts | Authenticated |
| `POST` | `/api/tickets/sawa-care/contracts` | Create Sawa Care managed contract | Authenticated |
| `GET` | `/api/tickets/sawa-care/contracts/:id` | Get Sawa Care contract details | Authenticated |
| `PATCH` | `/api/tickets/sawa-care/contracts/:id` | Update Sawa Care contract | Authenticated |
| `POST` | `/api/tickets/whatsapp-intake` | Webhook intake for WhatsApp chat bots (returns tracking URL) | Public / Authenticated |

### Client Experience & Self-Service Portal (Zero Login Required)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `GET` | `/api/public/tickets/track/:token` | Public real-time tracker: SLA countdown clock, vetted fundi credentials badge, transparent pricing, 30-day workmanship warranty, milestone progression, before/after photos | Public (128-bit Token) |
| `GET` | `/api/public/tickets/approve/:token` | Public view of repair quote estimate and technician notes for landlord sign-off | Public (128-bit Token) |
| `POST` | `/api/public/tickets/approve/:token` | One-click landlord approval/rejection (automatically waives diagnostic call-out fee upon approval) | Public (128-bit Token) |
| `GET` | `/api/public/properties/passport/:token` | Public Property Maintenance Passport: Health score (0–100), Airbnb Superhost readiness checklist, active warranties, recurring failure radar, lifetime service timeline | Public (128-bit Token) |
| `GET` | `/api/tickets/dashboard/client-experience-metrics` | Executive Client Experience Scorecard (First-time-fix rate, active warranties, warranty rework rate, quote acceptance rate, Airbnb managed units) | Authenticated |
| `POST` | `/api/properties/:id/preventive-inspections` | Schedule preventive package (`airbnb_guest_ready`, `pre_rains_leak_defense`, `quarterly_systems_check`) | Authenticated |
| `GET` | `/api/properties/:id/preventive-inspections` | List scheduled and completed preventive inspections for property | Authenticated |
| `PATCH` | `/api/properties/preventive-inspections/:id` | Complete preventive inspection, record checklist and condition rating, advance next due date (+90d) | Authenticated |

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
