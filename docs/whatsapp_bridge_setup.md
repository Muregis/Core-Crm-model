# Sawa Repairs: WhatsApp Ingestion Bridge Setup

This guide documents the architecture, configuration, and testing procedures for the **Sawa Repairs WhatsApp Bridge**, connecting incoming WhatsApp messages directly into the Core CRM ticketing engine.

---

## 1. Architecture Overview

```
                      +-----------------------------+
                      |   Tenant / Landlord / Airbnb|
                      |   Sends WhatsApp Message    |
                      +--------------+--------------+
                                     |
                                     v
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
    +------------------------+             +------------------------+
    |  Meta WhatsApp Cloud   |             |  Twilio WhatsApp API   |
    |  Graph API Webhook     |             |  Inbound Webhook       |
    +-----------+------------+             +-----------+------------+
                |                                      |
                | POST /api/integrations/whatsapp/meta | POST /api/integrations/whatsapp/twilio
                +------------------+-------------------+
                                   |
                                   v
             +---------------------+---------------------+
             |         WhatsAppBridge Service            |
             |  1. Verify Webhook Signature / Token      |
             |  2. NLP/Regex Classification:             |
             |     - Trade (Plumbing, Electrical, etc.)  |
             |     - Priority (Emergency, Standard)      |
             |  3. Photo Media URL Ingestion             |
             +---------------------+---------------------+
                                   |
                                   v
             +---------------------+---------------------+
             |         ticketService.js Engine           |
             |  - Generates Ticket: SAW-2026-00041       |
             |  - Issues Cryptographic Tracking Token    |
             |  - Calculates SLA Response Due Time       |
             |  - Queues BullMQ Notification Job         |
             +---------------------+---------------------+
                                   |
                                   v
             +---------------------+---------------------+
             |      Outbound Auto-Reply via WhatsApp     |
             |  "Habari! Ticket SAW-2026-00041 created.  |
             |   Live Tracker: https://.../track/tr_...  |
             |   Emergency response target: 2–6 hours."  |
             +-------------------------------------------+
```

---

## 2. Option A: Meta WhatsApp Cloud API Setup (Recommended)

### 2.1 Meta App Configuration
1. Log in to [Meta for Developers](https://developers.facebook.com/).
2. Create an App of type **Business**.
3. Add the **WhatsApp** product to your app.
4. Note your **Phone Number ID** and generate a permanent **System User Access Token**.

### 2.2 Environment Variables (`backend/.env`)
```env
# Meta WhatsApp Cloud API Credentials
WHATSAPP_VERIFY_TOKEN=sawa_repairs_webhook_secret_2026
WHATSAPP_ACCESS_TOKEN=EAAG...your_meta_system_user_access_token...
WHATSAPP_PHONE_NUMBER_ID=109283746501928
```

### 2.3 Webhook Registration
In the Meta App Dashboard under **WhatsApp > Configuration**:
- **Callback URL**: `https://api.sawarepairs.com/api/integrations/whatsapp/meta?tenant_id=1`
- **Verify Token**: `sawa_repairs_webhook_secret_2026`
- Click **Verify and Save**. Core CRM handles the `hub.challenge` handshake automatically.
- Under **Webhook Fields**, subscribe to `messages`.

---

## 3. Option B: Twilio WhatsApp Setup

### 3.1 Twilio Console Setup
1. Log in to the [Twilio Console](https://console.twilio.com/).
2. Navigate to **Messaging > Senders > WhatsApp senders** (or Sandbox).
3. Configure the **Webhook URL for incoming messages**:
   - `https://api.sawarepairs.com/api/integrations/whatsapp/twilio?tenant_id=1`
   - HTTP Method: `POST`

### 3.2 Automated TwiML Response
When Twilio calls `/api/integrations/whatsapp/twilio`, the backend immediately generates the service ticket, creates the tracking token, and replies with standard TwiML XML containing the ticket number and live tracker URL.

---

## 4. Intelligent Classification Rules

The bridge automatically inspects incoming message text to classify category and urgency without requiring rigid menus:

### Priority Classification
| Trigger Keywords in Message | Assigned Priority | SLA Target |
|-----------------------------|-------------------|------------|
| `emergency`, `urgent`, `flooding`, `burst pipe`, `spark`, `smoke`, `fire`, `electric shock`, `danger` | **emergency** | 2–6 Hours |
| `planned`, `routine`, `inspection`, `renovation`, `quote`, `painting next week` | **planned** | 48–72 Hours |
| *All other requests* | **standard** | 24 Hours |

### Trade Category Classification
| Trigger Keywords | Assigned Category |
|------------------|-------------------|
| `pipe`, `water`, `leak`, `sink`, `tap`, `toilet`, `cistern`, `drain`, `sewer`, `plumb`, `geyser`, `boiler` | **plumbing** |
| `power`, `socket`, `electric`, `fuse`, `breaker`, `light`, `tripping`, `short circuit`, `heater` | **electrical** |
| `roof`, `mabati`, `ceiling`, `gutter`, `downpipe`, `tile`, `rain leak` | **roofing** |
| `paint`, `crack`, `wall`, `peel`, `plaster` | **painting** |
| `solar`, `inverter`, `battery`, `pv`, `clean energy` | **solar** |
| *Unclassified keywords* | **general** |

---

## 5. Ops Coordinator Fallback & Intake Speedometer

If a client calls on a landline or contacts a technician directly:
1. The Ops Coordinator clicks **"New Ticket"** in the web dashboard.
2. An integrated **Intake Timer** tracks elapsed seconds during call intake.
3. Target: Complete intake in under **180 seconds** (3 minutes).
4. Upon submission, the system generates the live tracking link (`/track/:token`) which the coordinator can SMS or WhatsApp to the client with one click.
