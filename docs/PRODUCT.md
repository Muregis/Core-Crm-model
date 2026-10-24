# Core CRM — Product Document

**Status:** Production-Ready & Feature-Complete (Phase 1, Phase 2 & Commercial Core Verified)  
**Repo baseline:** 17 Jest Test Suites, 97 / 97 Tests Passing (100%), 0 Vite Build Errors  
**Audience:** Founders, executives, engineering team, reviewers, design partners  

---

## 1. What Core CRM is

Core CRM is a **multi-tenant operations and CRM platform** engineered specifically for Kenyan SMEs, land/real estate companies, commercial distributors, and professional law firms.

It is structured into three foundational layers:

| Layer | Purpose |
|-------|---------|
| **Shared Core** | Multi-tenant identity, RBAC, contacts, leads, deals/pipeline, tasks, documents, BullMQ async jobs, Safaricom Daraja M-Pesa credential vault, KDPA 2019 compliance, and Executive P&L analytics. |
| **Industry Packs** | Domain modules that plug into the shared core: **Land & Real Estate**, **Commercial Core / Wholesale**, and **Legal Practice / Advocacy**. |
| **Tenant Isolation** | Every business record is scoped by `tenant_id`; an automated safety layer (`db.forTenant(tenantId)`) ensures cross-tenant reads and writes fail closed with 404. |

**Positioning one-liner:**  
*One multi-tenant core for relationships and money-in-motion; industry-native inventory and workflows for Kenya's primary economic sectors.*

---

## 2. Who it is for & Industry Verticals

### 1. 🏢 Land & Real Estate Operations (Safari Real Estate Ltd)
- **Key Workflows**:
  - **Interactive Plot Matrix**: Visual estate grid with color-coded plots (Green = Available, Yellow = Timed Hold, Red = Sold).
  - **Timed Reservation Holds**: 24-hr, 48-hr, or 72-hr countdown window tied to Letter of Offer (LOO) generation. Plots automatically revert to Available if deposit isn't matched.
  - **"Lipa Mdogo Mdogo" 4-Stage Installment Tracker**: Auto-generates statutory milestone schedules (10% Deposit, 30% Beaconing, 30% LCB Consent, 30% Title Handover) with automated Safaricom Daraja receipt matching.
  - **Saturday Site Visit Convoy Booking**: Fleet management (33-seater shuttles, 14-seater vans, 4x4s) departing Kencom CBD / Westlands with seat quotas and interactive passenger manifests.
  - **ArdhiSasa 5-Stage Conveyancing Pipeline**: Regulatory kanban board eliminating the legal black box (Search $\rightarrow$ Beacon $\rightarrow$ LCB $\rightarrow$ Stamp Duty $\rightarrow$ Title Deed).

### 2. 💼 Commercial Core & Wholesale (Apex Commercial Supplies Ltd)
- **Key Workflows**:
  - **Products & Services Catalog**: SKU management, units of measure, and KES pricing.
  - **Quotation & Tax Invoice Engine**: Itemized line items, automated **16% VAT**, and KRA eTIMS Fiscal CU numbers (`KRA-ETIMS-XXXX`).
  - **1-Click Convert Quote to Invoice**: Transforms quotation (`QT-2026-XXXX`) into tax invoice (`INV-2026-XXXX`) with foreign key preservation.
  - **Branded PDF Print Modal**: KRA-compliant printable tax invoices.
  - **30/60/90-Day Debtor Aging**: Real-time receivable aging buckets with 1-click WhatsApp payment demand dispatch (`wa.me`).
  - **M-Pesa STK Push Integration**: Triggers STK pushes directly from invoice rows, automatically updating debtor ledgers on callback.

### 3. ⚖️ Legal Practice & Advocacy (Nairobi Advocates LLP)
- **Key Workflows**:
  - **Kenyan Constitutional Hierarchy (Arts. 159–173 CoK 2010)**: Superior Courts of Record (Supreme Court, High Court, ELC, ELRC), Subordinate Courts, and Specialized Tribunals.
  - **Judiciary e-Filing Standardization**: Case numbering (`HCCC NO. E... OF 2026`), pleading standing (`Plaintiff vs Defendant`, `Petitioner vs Respondent`), and coram honorifics.
  - **Advocates Remuneration Order (ARO)**: Instruction fees, 16% VAT, and disbursements calculation with Order 11 pre-trial conference tracking.

### 4. 📊 Executive Leadership & Boardroom (All Verticals)
- **Key Workflows**:
  - **P&L Financial Scorecard**: Gross revenue inflows, Operating Expenditure (OPEX), Net Profit, and Net Operating Margin %.
  - **Staff Productivity & Appraisal Matrix (Bonuses vs Layoffs)**:
    - Ranks staff by Net Contribution and Productivity ROI Multiplier ($\text{Revenue Generated} / \text{Cost Incurred}$).
    - Decision tags: 🌟 *Star Performer (Bonus Recommended)*, 🟢 *Solid Contributor (Retain & Expand)*, 🟡 *Needs Coaching (Performance Watch)*, 🔴 *Underperforming (At-Risk / Layoff Review)*.
  - **Operating Expenditure (OPEX) Ledger**: Salaries, commissions, transport/fuel, legal fees, and marketing with receipt tracking.

---

## 3. Product Architecture (Logical)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tenant Boundary (tenant_id)                     │
│  Auth · Users · Roles · Settings · M-Pesa Encrypted Vault · KDPA 2019  │
├────────────────────────────────────────────────────────────────────────┤
│  Shared Core CRM                                                       │
│  Contacts · Leads · Deals · Tasks · Docs · Activity · Jobs · OPEX      │
├──────────────────────┬──────────────────────────┬──────────────────────┤
│  Land Pack           │  Commercial Core Pack    │  Legal Pack          │
│  Plot Matrix (Grid)  │  Products Catalog (SKUs) │  Court Hierarchy     │
│  Lipa Mdogo Mdogo    │  Quotes & Invoices (VAT) │  Judiciary e-Filing  │
│  Saturday Convoys    │  1-Click Conversion      │  ARO Fee Scale       │
│  ArdhiSasa Pipeline  │  30/60/90 Debtor Aging   │  Billable Hours      │
└──────────────────────┴──────────────────────────┴──────────────────────┘
         │
         ▼
  BullMQ Async Workers · Redis Queue · P&L & Staff Productivity Engine
```

**Rules that do not bend:**
- API and workers always filter by `tenant_id` from a trusted source (JWT / job payload).
- Job audit rows are created with `tenant_id`; event handlers never update by `job_id` alone.
- Cross-tenant requests fail closed with `404 Not Found`.

---

## 4. Implementation Status (Code Reality)

### 4.1 Implemented & Verified Capabilities

| Capability | Module | Evidence | Status |
|------------|--------|----------|--------|
| Multi-tenant register / login / refresh / logout | Core | `tests/auth.test.js`, `tests/saas_multitenant.test.js` | 🟢 Verified |
| Contacts (customers), leads, deals, tasks | Core | `tests/customers.test.js`, `tests/leads.test.js`, `tests/deals.test.js` | 🟢 Verified |
| Strict Tenant Isolation (Cross-tenant 404) | Core | All 17 Jest test suites | 🟢 Verified |
| M-Pesa AES-256 Vault + C2B Shortcode Routing | Core | `tests/saas_multitenant.test.js` | 🟢 Verified |
| KDPA Export (Sec 26) + PII Anonymization | Core | `tests/saas_multitenant.test.js` | 🟢 Verified |
| BullMQ Async Reporting Pipeline (Producer → Worker → Status) | Core | `tests/jobs.test.js`, `tests/reportProducer.test.js` | 🟢 Verified |
| Versioned DB Migrations (Comment-safe) | Core | `tests/migrate.split.test.js` | 🟢 Verified |
| Interactive Plot Matrix & 48h Timed Holds | Land Pack | `tests/advanced_features.test.js`, `Parcels.jsx` | 🟢 Verified |
| Lipa Mdogo Mdogo 4-Stage Installments | Land Pack | `tests/sprint_upgrades.test.js`, `Parcels.jsx` | 🟢 Verified |
| Saturday Site Visit Convoys & Manifests | Land Pack | `tests/sprint_upgrades.test.js`, `Parcels.jsx` | 🟢 Verified |
| ArdhiSasa 5-Stage Conveyancing Pipeline | Land Pack | `tests/advanced_features.test.js`, `Deals.jsx` | 🟢 Verified |
| Products Catalog (SKUs, KES List Price) | Commercial Pack | `tests/sprint_upgrades.test.js`, `Invoices.jsx` | 🟢 Verified |
| Quotes & Tax Invoices (16% VAT, eTIMS) | Commercial Pack | `tests/sprint_upgrades.test.js`, `Invoices.jsx` | 🟢 Verified |
| 1-Click Convert Quote to Invoice | Commercial Pack | `tests/sprint_upgrades.test.js`, `Invoices.jsx` | 🟢 Verified |
| 30/60/90-Day Debtor Aging & WhatsApp Dispatch | Commercial Pack | `Invoices.jsx` | 🟢 Verified |
| Court Hierarchy & Legal Retainers | Legal Pack | `tests/matters.test.js`, `Matters.jsx` | 🟢 Verified |
| Executive P&L Scorecard & Staff Appraisal Matrix | Analytics | `tests/analytics.test.js`, `Analytics.jsx` | 🟢 Verified |
| OPEX Ledger & Expenditure Tracking | Analytics | `tests/analytics.test.js`, `Analytics.jsx` | 🟢 Verified |

---

## 5. Competitive Differentiation (How Core CRM Wins)

| Category | Global CRM (Salesforce / HubSpot) | Generic ERP / CRM Light | Core CRM Advantage |
|---|---|---|---|
| **Real Estate & Land** | Requires expensive third-party custom apps; no plot state machine or ArdhiSasa knowledge. | Basic spreadsheet tables without timed reservation holds or conveyancing steps. | **Native Plot Matrix**: 48h auto-expiring holds, Lipa Mdogo Mdogo 4-milestone calculator, Kencom Saturday convoys, ArdhiSasa pipeline. |
| **Commercial Billing** | Generic invoicing lacking KRA eTIMS and statutory 16% VAT calculation. | Manual invoicing without automated STK push reconciliation. | **Kenyan Invoicing Standard**: Automated 16% VAT, KRA eTIMS CU numbers, 1-click quote conversion, 30/60/90 debtor aging with WhatsApp dispatch. |
| **Legal Practice** | Foreign court structures; no understanding of Kenyan judiciary divisions. | Basic contact lists. | **Constitutional Court Hierarchy**: High Court, ELC, ELRC, Tribunals, Order 11 pre-trial conference, ARO fee calculation. |
| **Payments** | Credit-card first (Stripe/PayPal); M-Pesa requires complex third-party middleware. | Manual bank slip entry. | **Native Safaricom Daraja**: Encrypted per-tenant credentials vault, C2B routing by shortcode, STK Push auto-reconciliation. |
| **Executive Governance** | High subscription costs for basic business intelligence. | Basic sales totals. | **P&L Scorecard & Staff ROI Matrix**: Real-time staff appraisal recommendations (Bonuses vs Layoffs) and Boardroom Brief export. |
| **Data Privacy** | GDPR-focused. | Ignored. | **KDPA 2019 Ready**: PII log redaction, Section 26 data exports, irreversible customer anonymization. |

---

## 6. Verification & Test Evidence

- **Unit & Integration Tests**: 17 Test Suites, 97 Tests, 100% Passing.
- **Frontend Build**: Vite v5.4.21 production build passes with 0 errors.
- **Multi-Tenant Isolation**: 100% verified across all routes and background jobs.
