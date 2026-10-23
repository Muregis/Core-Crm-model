# Core CRM — Product Document

**Status:** Draft for planning (engineering gate closed for product work)  
**Repo baseline:** `main` @ `b5818dbc` (PR #9 merged)  
**Audience:** Founders, engineers, early design partners  
**Non-goals of this doc:** Production sign-off, pricing finalization, full UI specs

---

## 1. What Core CRM is

Core CRM is a **multi-tenant operations platform** for Kenyan SMEs and professional firms. It is not “CRM only” and not “land brokerage only.”

It is built as:

| Layer | Purpose |
|-------|---------|
| **Shared core** | Tenants, users, contacts, leads, deals/pipeline, tasks, documents, activity, async jobs, payments (M-Pesa), reporting skeleton |
| **Industry packs** | Domain modules that plug into the same core (Land Inventory first; Law / professional services next) |
| **Tenant isolation** | Every business record is scoped by `tenant_id`; cross-tenant reads/writes must fail closed |

**Positioning one-liner:**  
*One multi-tenant core for relationships and money-in-motion; pack-specific inventory and workflows for each industry.*

---

## 2. Who it is for

### Primary (near term)
- Land sellers / brokers / developers managing parcels, status, and deals
- Professional services firms (starting with law-firm-like case/matter patterns) that need clients, matters, tasks, and billing hooks

### Explicitly de-emphasized
- SACCOs as a go-to-market focus (harder sales cycle; still supported by the same multi-tenant core if they appear)

### Shared needs across target firms
1. **Clients / contacts** with ownership history  
2. **Pipeline or case status** (deal stages or matter stages)  
3. **Inventory or work units** (parcels, matters, assets) linked to deals  
4. **Tasks & documents** per record  
5. **Payments** (M-Pesa first)  
6. **Async reports** that never leak across tenants  
7. **KDPA-minded** data export / anonymization  

---

## 3. Product architecture (logical)

```
┌─────────────────────────────────────────────────────────────┐
│                     Tenant boundary                         │
│  Auth · Users · Roles · Settings · M-Pesa credentials       │
├─────────────────────────────────────────────────────────────┤
│  Shared core                                                │
│  Contacts · Leads · Deals · Tasks · Docs · Activity · Jobs  │
├──────────────────────┬──────────────────────────────────────┤
│  Land pack (P1)      │  Professional pack (P2)              │
│  Parcels · Zoning    │  Matters · Deadlines · Time (later)  │
│  Status · Listings   │                                      │
└──────────────────────┴──────────────────────────────────────┘
         │
         ▼
  Async workers (BullMQ) · Reports · Imports · Email (later)
```

**Rules that do not bend**
- API and workers always filter by `tenant_id` from a trusted source (JWT / job payload written by producer).
- Job audit rows are created **with** `tenant_id`; event handlers never update by `job_id` alone.
- Platform-wide operator surfaces (e.g. worker inventory) are **not** on the tenant API.

---

## 4. What exists today (code reality)

### 4.1 Shared core — implemented

| Capability | Evidence |
|------------|----------|
| Multi-tenant register / login / refresh / logout | Auth routes + tests |
| Contacts (customers), leads, deals, tasks | CRUD + tenant isolation tests |
| RBAC (admin / manager / sales_rep patterns) | Middleware + tests |
| M-Pesa credential vault + C2B routing by shortcode | SaaS multitenant tests |
| KDPA export + anonymize | SaaS multitenant tests |
| Async sales report enqueue → worker → status API | Report producer, worker, jobs routes |
| Versioned migrations + comment-safe splitter | `scripts/migrate.js` + unit tests |
| Tenant-scoped job ownership on list/detail/result/retry | `routes/jobs.js` |

### 4.2 Engineering gate (PR #9) — implemented, not fully proven in prod

| Item | Status |
|------|--------|
| Migration comments no longer drop `CREATE TABLE` | Fixed + unit covered |
| CI workflow structure cleaned | Fixed |
| `/workers/active` removed from tenant API | Fixed |
| Queue events require tenant context | Fixed |
| Report idempotency returns same job id | Fixed in code |
| Jest suite on GitHub Actions | **Must be confirmed green on latest main** |
| MySQL + Redis end-to-end on real host | **Unverified** |
| Concurrent identical idempotency keys | **Unverified** |

See also: `docs/ENGINEERING_GATE.md`.

### 4.3 What does **not** exist yet

- Land Inventory pack (parcels, title refs, size, zoning, listing status)
- Law / professional pack (matters, court dates)
- Full product UI for inventory
- Platform-operator role
- Formal SLA / multi-region / SOC-style claims

---

## 5. Industry pack: Land (Phase 1 product priority)

### 5.1 Problem
Land operators juggle spreadsheets for parcels, WhatsApp for clients, and separate tools for payments. Core CRM already has clients, deals, and M-Pesa; it lacks a first-class **inventory of land assets** tied to deals.

### 5.2 Land pack — MVP scope

| Entity / feature | Notes |
|------------------|-------|
| **Parcel** | Tenant-scoped; title/plot ref; size; location (county/ward optional); status (`available`, `reserved`, `sold`, `withdrawn`) |
| **Link to deal** | Optional `deal_id`; one active deal per reserved/sold parcel preferred |
| **Link to contact** | Buyer / seller / both as roles on the deal |
| **Status history** | Lightweight audit (who/when/status) |
| **List + filter** | By status, county, price band |
| **Report extension** | Sales report can include parcel counts / sold area (after MVP) |

**Out of scope for MVP:** GIS maps, title search integrations, multi-currency beyond KES, public listing marketplace.

### 5.3 Success metrics (pilot)
- Time to record a new parcel + attach to a deal &lt; 2 minutes
- Zero cross-tenant parcel visibility in isolation tests
- Pilot firm can answer “what is available in X county?” without Excel

---

## 6. Industry pack: Professional / law-firm patterns (Phase 2)

Shared with land and other firms: clients, pipeline/status, tasks, docs, payments.

**Phase 2 increments (not built yet)**
- Matter / case record linked to contact
- Stage model (intake → active → closed)
- Deadline / court-date field on matter
- Same tenant isolation and job model as core

No separate product binary — same SaaS, pack enabled per tenant.

---

## 7. Competitive landscape (how we win)

### 7.1 Typical alternatives

| Class | Examples of what they sell | Gaps for our buyers |
|-------|----------------------------|---------------------|
| Global CRM | Salesforce, HubSpot — contacts, pipeline, marketing | Heavy, costly, weak local payments & inventory for land |
| Regional SME tools | Generic CRM / ERP light | Often single-tenant or weak multi-tenant isolation |
| Spreadsheets + WhatsApp | Free, familiar | No audit trail, no isolation, no M-Pesa ledger |
| Vertical land software | Listing / estate platforms | Often brokerage marketing-first, not ops + payments |

### 7.2 How Core CRM competes

1. **Multi-tenant from day one** — isolation is a product feature, not an afterthought.  
2. **Kenya-native money path** — M-Pesa credentials encrypted per tenant; C2B routed by shortcode.  
3. **Core + packs** — land inventory without forking the product for each industry.  
4. **Honest scope** — async reports and jobs designed for tenant ownership; platform ops kept off tenant APIs.  
5. **KDPA-oriented** export/anonymize hooks already in the core story.

We do **not** claim to beat Salesforce on marketing automation or full ERP depth. We claim a **credible ops system** for Kenyan relationship + inventory + payments workflows.

---

## 8. Verification boundary (do not blur)

### Approved for
- Product definition and roadmap writing  
- Land pack design and sequencing  
- Pilot conversations with clear “verified / not yet verified” language  

### Not approved for
- Production “go live” marketing  
- Claims that MySQL + Redis E2E is proven on customer hardware  
- Treating CI silence or local SQLite-only runs as full proof  

### Checklist before production approval

- [ ] Latest GitHub Actions on `main` is green  
- [ ] `node scripts/migrate.js` on **fresh** MySQL  
- [ ] Same migrations on DB with **legacy** rows (tenant_id backfill path)  
- [ ] Tenant A: enqueue report → 202 → completed result  
- [ ] Tenant B: `GET` A’s `jobId` → **404**  
- [ ] Idempotent second enqueue returns same `jobId`  
- [ ] Retry + exhausted failure behavior observed with worker + Redis  
- [ ] Record residual risks in this document or ENGINEERING_GATE.md  

---

## 9. Roadmap (product, not infra thrash)

| Phase | Focus | Outcome |
|-------|--------|---------|
| **0** | Engineering gate (done for planning) | Shared core reliable enough to specify packs |
| **1** | Land Inventory pack | Parcels + status + deal link + isolation tests |
| **1b** | Verification checklist | Production-approval decision |
| **2** | Professional / matter pack | Same core, new entities |
| **3** | Deeper reporting & imports | Still tenant-scoped workers |

**Explicit non-roadmap:** inventing more job infrastructure before Land pack delivers pilot value.

---

## 10. Open product decisions

1. **Pack enablement:** flag per tenant vs always-on modules?  
2. **Parcel unique key:** title number uniqueness per tenant only (recommended).  
3. **Pricing:** per seat vs per tenant vs per pack — deferred.  
4. **Public listings:** out of MVP; may stay out of product forever.  

---

## 11. Document control

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-10-23 | Initial product document after PR #9 merge; planning-approved, production-pending |

**Owner:** Product + eng leads  
**Related:** `docs/ENGINEERING_GATE.md`, `docs/PHASE1_REPORT_HARDENING.md`, `docs/API.md`
