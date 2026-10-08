# Kenya CRM

CRM-oriented platform aimed at Kenyan SMEs and SACCOs: customer/lead management, sales pipeline, role-based access, and localization hooks (counties, KES, M-Pesa-oriented payment tracking).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, JWT + bcrypt |
| Database | MySQL 8+ |
| Deploy helper | Docker Compose |

## Project layout

```
├── frontend/          # React (Vite) app
├── backend/           # Express API
├── database/          # schema + seed SQL
├── docs/              # setup / API notes
├── docker-compose.yml
└── setup.sh
```

## Quick start

**Prerequisites:** Node.js 18+, MySQL 8+

```bash
# Database
mysql -u root -p -e "CREATE DATABASE kenya_crm;"
mysql -u root -p kenya_crm < database/schema.sql
mysql -u root -p kenya_crm < database/seed_data.sql

# Backend
cd backend && cp .env.example .env   # set DB credentials
npm install && npm run dev          # default :5000

# Frontend (separate terminal)
cd frontend && cp .env.example .env
npm install && npm run dev          # default :5173
```

Or use Docker Compose when configured:

```bash
docker-compose up -d
```

Default admin (from seed data — change in any real deployment): see seed / docs.

## Implemented focus areas

- JWT auth and role-based access (admin / sales / manager style roles)
- Customer profiles with county-oriented fields
- Lead and pipeline-oriented modules
- Payment / M-Pesa-oriented transaction tracking UI and API hooks
- Basic analytics charts on the dashboard

Exact feature depth varies by module — inspect `backend/` and `frontend/src/` for what is wired end-to-end.

## Status

Active development. Suitable as a portfolio and starting point for Kenyan-market CRM workflows. Harden secrets, tests, and production config before any real customer use.

## License

MIT (if present in repo).

---

Built by Victor Muregi for Kenyan business contexts.
