# Engineering gate — closed for product work

## What was fixed in this branch

| Gate item | Resolution |
|-----------|------------|
| Migration comments discarding CREATE TABLE | `splitStatements` **discards** `--` / `/* */` comments instead of attaching them to the next SQL statement |
| CI YAML duplicates / broken install step | Clean single `runs-on` / `defaults`; one `npm ci`; syntax checks on critical files |
| `/workers/active` exposed to tenant admins | **Removed** from tenant-facing jobs API |
| Queue events unscoped updates | Updates require verified `tenant_id`; no job_id-only fallback |

## Verified locally (splitter)

Leading comment block + CREATE TABLE + INSERT + ALTER → three statements; CREATE is preserved.

## What you must still run before calling Phase 1 "proven"

```bash
cd backend
node scripts/migrate.js
npm start   # + npm run worker with Redis
# Two tenants: A gets 202 + result; B gets 404 on A's jobId
```

## Honest product baseline for the Product Document

**Exists and is intended for pilots**
- Multi-tenant shared core (contacts, leads, deals, tasks, docs, M-Pesa routes)
- Async sales report slice with tenant-scoped queries and ownership checks
- Migration path for tenant_id on core tables

**Not yet proven in this environment**
- Full MySQL + Redis end-to-end on your hosting
- Idempotency under concurrent identical requests
- Platform-operator role (intentionally deferred)

**Next product phase (after local checklist)**
- Land Inventory pack — not more job infrastructure
