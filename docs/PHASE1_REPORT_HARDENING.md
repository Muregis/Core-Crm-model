# Phase 1 Report Hardening — Verification Guide

## What this branch fixes

1. **server.js** — removed duplicated middleware and startup fragments (file was not parseable).
2. **MySQL tenant isolation** — migration `003_tenant_isolation_core.sql` adds `tenant_id` to deals, customers, leads, jobs, and related tables; backfills existing rows to tenant 1.
3. **queue/events.js** — only UPDATEs existing audit rows. Never INSERTs jobs without tenant context (producers own creation).
4. **report pipeline** — producer requires authenticated tenantId + userId; worker refuses work without tenant; all deal queries scoped; API routes enforce ownership.

## Apply migration (MySQL production)

```bash
mysql -u USER -p kenya_crm < database/migrations/003_tenant_isolation_core.sql
```

SQLite already has tenant columns via `database-sqlite.js`.

## End-to-end checklist (must pass before merge)

- [ ] `node --check backend/server.js` (and other changed files)
- [ ] API starts: `npm start`
- [ ] Worker starts: `npm run worker` (Redis up)
- [ ] Migration applied on MySQL (or using SQLite locally)
- [ ] As tenant A admin: `POST /api/reports` → **202** + jobId
- [ ] `GET /api/jobs/:id` as tenant A → waiting → active → completed with `{ totalDeals, wonDeals, revenueKes, tenantId }`
- [ ] `GET /api/jobs/:id` as tenant B → **404**
- [ ] `GET /api/jobs/:id/result` as tenant A → summary; as B → 404
- [ ] Same Idempotency-Key from same tenant does not create duplicate job
- [ ] Redis down at enqueue → 503; audit row shows failure for that tenant only

## Product alignment

Infrastructure serves the product. One complete vertical slice (async sales report) with real multi-tenant isolation. Next product step after this is Land Inventory pack — not more job types.
