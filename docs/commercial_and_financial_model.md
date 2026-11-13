# SAWA REPAIRS — COMMERCIAL, FINANCIAL & ACQUISITION OPERATING MODEL
**From Technical Ferrari to Commercial Execution: Economics, SLA Alignment & Customer Acquisition**  
*(Companion to Product Document v2.2 & Core CRM Backend)*

---

## 1. The Financial Model (OpEx, Unit Economics & Break-Even)

The Core CRM tracks gross margin per ticket. To make that number meaningful, Sawa must anchor it against its fixed operating cost structure (**Monthly Burn**), per-ticket variable contribution, and break-even ticket volume.

### 1.1 Fixed Operating Costs (Monthly OpEx) — Phase 1 (Nairobi Pilot)

| Cost Item | Monthly (KES) | Monthly (USD) | Notes & Assumptions |
|---|---|---|---|
| **Ops Coordinator / Customer Lead (1 FTE)** | KES 50,000 | ~$385 | Triage, intake, fundi dispatch, customer communications, QA check |
| **Lead Quality Inspector / Master Fundi Retainer** | KES 40,000 | ~$308 | Retainer for diagnostic QA, escalated calls, tool kit maintenance (plus per-ticket split) |
| **Cloud Hosting & Systems Infrastructure** | KES 8,000 | ~$62 | DigitalOcean Droplet (Node.js API, MySQL, Redis, PM2), Domain, SSL, Sentry |
| **WhatsApp Business API & Telephony** | KES 5,000 | ~$38 | Meta WhatsApp conversation charges, Twilio fallback, Safaricom data lines |
| **Transport Allowance Buffer / Van Depreciation** | KES 12,000 | ~$92 | Motorbike/fuel allowances for emergency dispatch in Kilimani/Westlands/Kileleshwa |
| **Tools, Safety Gear & Insurance Buffer** | KES 10,000 | ~$77 | Multimeters, pressure gauges, pipe wrenches, safety equipment maintenance |
| **Total Monthly Fixed Burn (OpEx)** | **KES 125,000** | **~$962** | **Baseline cost required to keep Sawa Repairs operational each month** |

---

### 1.2 Variable Unit Economics per Ticket (Standard vs. Emergency Fix)

| Line Item | Standard Plumbing/Electrical Repair | Emergency Burst Pipe / Power Outage |
|---|---|---|
| **Diagnostic Call-out Fee** | KES 2,000 *(Waived on quote approval)* | KES 2,000 *(Waived on quote approval)* |
| **Emergency Priority Premium** | KES 0 | KES 1,000 |
| **Billed Labour** (2.5 hrs @ KES 1,200/hr) | KES 3,000 | KES 3,000 |
| **Wholesale Parts** | KES 4,000 | KES 4,500 |
| **Parts Markup** (+20% capped handling) | KES 800 | KES 900 |
| **Total Client Invoice Amount** | **KES 7,800** | **KES 9,400** |
| **Direct Variable COGS**: | | |
| • Technician Payout (50% of labour) | KES 1,500 | KES 1,500 |
| • Wholesale Parts Purchase Cost | KES 4,000 | KES 4,500 |
| • Technician Travel Allowance | KES 500 | KES 800 |
| **Total Variable Cost (COGS)** | **KES 6,000** | **KES 6,800** |
| **Gross Margin KES per Ticket** | **KES 1,800 – KES 2,800** | **KES 2,600 – KES 3,600** |
| **Average Contribution Margin** | **~KES 2,800 (33.3%)** | **~KES 3,200 (34.0%)** |

---

### 1.3 Break-Even Analysis & Volume Targets

$$\text{Break-Even Volume} = \frac{\text{Monthly Fixed OpEx}}{\text{Average Contribution Margin per Ticket}} = \frac{\text{KES } 125,000}{\text{KES } 3,200} \approx \mathbf{39 \text{ tickets/month}}$$

$$\approx \mathbf{1.3 \text{ completed tickets / day}}$$

#### Break-Even Sensitivity with Sawa Care Managed Retainers
Sawa Care contracts provide recurring baseline revenue that drops the required ad-hoc ticket break-even volume dramatically:

| Active Sawa Care Retainers | Monthly Retainer Revenue | Remaining Fixed Burn to Cover | Ad-Hoc Tickets Needed to Break Even | Daily Ticket Run Rate |
|---|---|---|---|---|
| **0 Contracts (Ad-hoc only)** | KES 0 | KES 125,000 | **39 tickets** | 1.30 / day |
| **5 Contracts (@ KES 5,000/mo)** | KES 25,000 | KES 100,000 | **31 tickets** | 1.03 / day |
| **10 Contracts (@ KES 5,000/mo)** | KES 50,000 | KES 75,000 | **23 tickets** | 0.76 / day |
| **20 Contracts (@ KES 5,000/mo)** | KES 100,000 | KES 25,000 | **8 tickets** | 0.26 / day |

> [!IMPORTANT]
> **Commercial Imperative**: 10 Sawa Care contracts ($500/mo total) covers **40% of Sawa's entire fixed monthly overhead**. Every ad-hoc ticket thereafter flows straight to bottom-line profitability.

---

### 1.4 Runway & Capital Requirement
- **Phase 1 Pilot Runway (90 Days)**:
  - Month 1: 15 tickets (Gross Margin KES 48,000; Net burn: -KES 77,000)
  - Month 2: 35 tickets + 3 retainers (Gross Margin KES 127,000; Net: +KES 2,000)
  - Month 3: 65 tickets + 8 retainers (Gross Margin KES 248,000; Net: +KES 123,000)
- **Minimum Cash Reserve Needed**: **KES 350,000 (~$2,700 USD)** provides a full 3-month safety buffer to reach operating self-sufficiency.

---

## 2. SLA Alignment: Harmonizing Public Promises with the Engine

The Core CRM engine tracks response timers and empirical percentiles (`p50`, `p90`). The public marketing and operational SLAs must align so that the ops dashboard does not report false failures against uncommunicated expectations.

```
+------------------------------------------------------------------------------------------------------+
|                                   UNIFIED 3-TIER SLA FRAMEWORK                                       |
+-------------------+--------------------------------+----------------------------+--------------------+
| Tier / Category   | Public Client Commitment       | Engine Timer Threshold     | Breach Trigger     |
+-------------------+--------------------------------+----------------------------+--------------------+
| 1. Emergency      | "2–4h Emergency Dispatch;      | 6 Hours (Interim Nairobi   | Engine flags red   |
| (Burst pipe, leak,|  same-day containment"         | logistics buffer)          | alert at > 6h      |
| sparks, power out)|                                |                            |                    |
+-------------------+--------------------------------+----------------------------+--------------------+
| 2. Standard       | "Same-day or next business     | 36 Hours                   | Engine flags red   |
| (Dripping tap,    |  day arrival (24–48 hours)"    |                            | alert at > 36h     |
| socket, cistern)  |                                |                            |                    |
+-------------------+--------------------------------+----------------------------+--------------------+
| 3. Planned        | "Scheduled to your preferred   | 96 Hours (4 days)          | Engine flags red   |
| (Turnover repaint,|  slot (3–5 working days)"      |                            | alert at > 96h     |
| preventive check) |                                |                            |                    |
+-------------------+--------------------------------+----------------------------+--------------------+
```

### Operational Rules:
1. **Response vs. Arrival**: Public text clarifies that "Response" means **intake, triage, and technician assignment dispatch**. Arrival on-site follows the committed window.
2. **Interim Buffer**: The engine enforces a 6-hour ceiling on emergency tickets before flagging `is_sla_breached = 1`. This absorbs Nairobi traffic without corrupting empirical metrics.

---

## 3. Customer Acquisition Plan: Diaspora & Airbnb Playbooks

Customers will not stumble onto a ticketing platform organically. Acquisition requires outbound campaigns targeting the two segments experiencing acute maintenance pain.

### Segment A: Diaspora Landlords (UK, US, Gulf, Canada)

#### 1. Where They Congregate
- **Facebook Groups**: *Kenyans in the UK*, *Kenyan Diaspora Alliance*, *Kenyans in Dallas/Houston*, *Kenya Diaspora Property & Investment Forum*.
- **Investment WhatsApp Chamas**: Diaspora sacco groups (Stima Diaspora, Safaricom Diaspora, Kenya USA Diaspora Sacco).
- **Alumni Networks & Church Fellowships**: PCEA UK, Nairobi School/Alliance diaspora alumni groups.

#### 2. The Acquisition Hook: "The Free 10-Point Property Health Audit"
Never pitch a generic "fundi service." Pitch risk prevention and peace of mind:
> *"Before you renew your tenant's lease or while your apartment is between tenants, Sawa will inspect your Kilimani/Westlands property, generate a video walkthrough, and issue your Sawa Property Maintenance Passport with a 0–100 Health Score. 100% Free."*

#### 3. Direct Outreach Message Template (LinkedIn / WhatsApp / Facebook DM)
```text
Habari [Name],

I saw you have property investments in Nairobi while living in [UK/US]. 

The biggest headache diaspora owners tell us about is the 3:00 a.m. emergency call: a burst pipe or tenant complaining about an instant shower, followed by an informal fundi overcharging for parts with zero receipts and no warranty.

We built Sawa Repairs (sawarepairs.co.ke) to solve this:
• 100% ticketed repairs with photo proof and wholesale parts receipts.
• Landlord approval thresholds: you approve quotes on your phone before work starts.
• 30-Day Workmanship Guarantee on every single job.
• Consolidated Monthly Statements for your tax and rental accounts.

We're offering 5 diaspora landlords this month a Complimentary 10-Point Property Health Audit & Video Walkthrough for any rental in Kilimani, Kileleshwa, or Westlands. 

Would you like us to run a health check on your property this week?
```

---

### Segment B: Multi-Property Airbnb Hosts (Nairobi Missing Middle)

#### 1. Where They Congregate
- **Nairobi Airbnb Hosts WhatsApp Communities**: *Kilimani Short-Let Operators*, *Westlands Hosts Hub*.
- **Direct Listing Identification**: Search Airbnb and Booking.com for Superhosts managing 3–15 listings in Kilimani, Kileleshwa, and Westlands.
- **Cleaning & Co-hosting Agencies**: Partner with independent turnover cleaning teams who spot broken fittings first.

#### 2. The Acquisition Hook: "The 2-Hour Superhost Rescue"
> *"A guest shower fails at 6:00 PM on a Friday. If it's not fixed by 8:00 PM, you get a 1-star review and a 50% refund dispute on Airbnb. Save Sawa's emergency dispatch number in your phone: 2–4h emergency dispatch with a 30-day warranty."*

#### 3. Direct Outreach Message Template (WhatsApp to Airbnb Hosts)
```text
Habari [Host Name],

Saw your beautiful listings in [Kilimani/Kileleshwa]. As a multi-property host, you know that one broken water heater or leaking toilet at check-in can destroy a Superhost rating.

Sawa Repairs (sawarepairs.co.ke) provides ticketed maintenance specifically for Nairobi Airbnb operators:
1. Priority 2–4 Hour Emergency Response for guest-in-house emergencies.
2. Digital Guest-Ready Turnover Audits (electrical loads, water pressure, locksets).
3. 30-Day Workmanship Warranty: If the issue recurs within 30 days, we fix it at zero cost.
4. One monthly itemized statement for all your units.

Can we send a lead technician to perform a free Guest-Ready Audit on one of your units this Tuesday?
```

---

## 4. The Deployment Gap: Phase 1 vs. Phase 2 Architecture

### The Reality Check
- **Current Site State**: Every CTA on `sawarepairs.co.ke` connects directly to WhatsApp: `https://wa.me/254797846126`.
- **Current Backend State**: The Core CRM API, database, and public token portals (`/track/:token`, `/approve/:token`, `/passport/:token`) are complete and verified locally.

### Can Phase 1 Start Immediately? YES.

```
                          PHASE 1 (TODAY — LIVE VALIDATION)
       ========================================================================
       Customer (Site / Referral) ──▶ WhatsApp (+254 797 846 126)
                                               │
                                               ▼
                             Ops Coordinator / Founder (Human)
                             • Evaluates message in 60s
                             • Opens Core CRM (/tickets)
                             • Uses 90s Manual Intake Form
                                               │
                                               ▼
                             Core CRM generates /track/:token link
                                               │
                                               ▼
                             Coordinator pastes tracking link into WhatsApp
                             "Habari! Ticket SAW-2026-00012 logged.
                              Track live fundi progress here: [link]"
```

### Why Human-in-the-Loop is an Asset for the First 20 Tickets:
1. **Commercial Agility**: The founder talks directly to the first 20 landlords, uncovers unspoken fears, and tests pricing tolerance in real conversation.
2. **Zero Bot Failures**: Prevents automated NLP misclassifications or webhook drops from damaging early trust.
3. **Data Gate Enforcement**: Guarantees that every completed job has accurate labour hours and parts receipts logged before closing.

### Phase 2 (Automated Cloud Rollout — 1-Day Deployment Sprint):
- Deploy `core-crm-api` and `core-crm-worker` via PM2 to a production cloud server (DigitalOcean / AWS).
- Register the Meta Cloud API webhook to `https://api.sawarepairs.com/api/integrations/whatsapp/meta`.
- Transition from manual coordinator copy-paste to instantaneous automated WhatsApp bot replies.
