# Phase 1 lifecycle + migration reliability fix

## Review blockers addressed

1. **Migration runner** (`backend/scripts/migrate.js`)
   - Only records a migration as applied after **all** statements succeed
   - Non-ignorable errors abort the run (exit 1)
   - Duplicate-column / already-exists treated as OK for idempotent ALTERs
   - No DELIMITER support (documented)

2. **Migration 003** rewritten without stored procedures / DELIMITER
   - Plain `ALTER TABLE ... ADD COLUMN` + backfill UPDATEs
   - Compatible with semicolon splitter

3. **Queue events** (`backend/src/queue/events.js`)
   - Load `tenant_id` from jobs row, update with `job_id` + `tenant_id`
   - Do **not** increment attempts (worker owns attempt count)
   - Permanent `failed` only when attempts >= max_attempts

4. **Report worker**
   - Sets `attempts` from BullMQ `attemptsMade`
   - Intermediate failure → `waiting`; final failure → `failed`

## Required local verification

```bash
cd backend
node --check scripts/migrate.js
node scripts/migrate.js   # must succeed; 003 applied or already applied cleanly
npm start                 # terminal 1
npm run worker            # terminal 2, Redis up
# POST /api/reports as tenant A → 202
# GET /api/jobs/:id as A → completed
# GET /api/jobs/:id as B → 404
```

If 003 was previously marked applied while columns are missing, delete that row from `schema_migrations` and re-run migrate.
