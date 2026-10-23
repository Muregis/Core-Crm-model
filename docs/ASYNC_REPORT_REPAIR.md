# Async Sales Report Repair

## Changes
- `backend/workers/report.worker.js` — removed duplicated/malformed code; all queries require valid tenant_id; status updates are tenant-scoped
- `backend/src/jobs/producers/reportProducer.js` — requires authenticated tenantId + userId; tenant-prefixed idempotency keys; audit row written before enqueue
- `backend/src/routes/reports.js` — passes tenant_id and user id from JWT; returns 202
- `backend/src/routes/jobs.js` — strict tenant ownership on list/stats/detail/result/retry; no cross-tenant access; workers/active restricted to admin

## Schema (already present in SQLite)
- `deals.tenant_id` — required
- `jobs` — tenant_id, job_id, type, status, result, attempts, max_attempts, error_message, started_at, completed_at, failed_at

## Verify before merge
1. POST /api/reports as admin/manager → 202 + jobId
2. GET /api/jobs/:id as owning tenant → status progression
3. GET /api/jobs/:id as other tenant → 404
4. Worker processes job with tenant-scoped sales summary
5. Failed job retries do not leak across tenants

Aligned with Core CRM Product Document Phase 1: reliable shared-core reporting with multi-tenant isolation.
