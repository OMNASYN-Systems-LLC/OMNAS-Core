# OMNAS Assembler

A modular full-stack starter project with:
- **Backend:** Node.js + Express + PostgreSQL (`pg`)
- **Frontend:** React + Vite + React Router

## Project Structure

```text
OMNAS-Core/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/migrations/
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── workers/
│   │   │   ├── contractors/
│   │   │   ├── skills/
│   │   │   └── jobs/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── router/
│   │   ├── services/
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── .env.example
```

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Apply migrations in order:

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/001_workforce_profiles.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/002_jobs.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/003_matching.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/004_assignments.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/005_daily_logs.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/006_opportunities.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/007_opportunities_normalized_fields.sql
psql "$DATABASE_URL" -f backend/src/db/migrations/008_opportunities_enrichment_fields.sql
```

Run apps:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## Workforce + Jobs API

Authentication is mocked via headers for local development:
- `x-user-id: <uuid>`
- `x-user-role: worker | contractor`

### Worker endpoints (`x-user-role: worker`)
- `PUT /api/workers/profile`
- `GET /api/workers/profile`
- `POST /api/workers/skills`
- `DELETE /api/workers/skills/:skillId`

### Contractor endpoints (`x-user-role: contractor`)
- `PUT /api/contractors/profile`
- `GET /api/contractors/profile`

### Jobs endpoints
- `POST /api/jobs` (contractor only, requires at least one required skill)
- `GET /api/jobs`
- `GET /api/jobs/:id`
- `PATCH /api/jobs/:id` (contractor only)
- `DELETE /api/jobs/:id` (contractor only)
- `GET /api/jobs/:id/matches` (contractor only; computes + stores match scores)



### Assignments endpoints
- `POST /api/assignments` (contractor only; creates offered assignment)
- `PATCH /api/assignments/:id/accept` (worker only)
- `PATCH /api/assignments/:id/decline` (worker only)
- `PATCH /api/assignments/:id/start` (worker only)
- `PATCH /api/assignments/:id/complete` (worker/contractor if related)
- `GET /api/assignments/:id`
- `GET /api/assignments`

### Daily logs endpoints
- `POST /api/assignments/:id/logs` (worker only; assignment must be accepted/active)
- `GET /api/assignments/:id/logs`
- `GET /api/logs/:id`

### Opportunities endpoints
- `POST /api/opportunities/fetch` (contractor only; fetches from SAM.gov and stores raw records with status `fetched`)
- `POST /api/opportunities/normalize` (contractor only; normalizes `fetched` records from `raw_json`, sets status to `normalized`)
- `POST /api/opportunities/enrich` (contractor only; enriches `normalized` records from `raw_json`, sets status to `ready`)

### Shared endpoints
- `GET /api/skills`
- `GET /api/health`

## Frontend Pages

- `/login`
- `/register`
- `/worker-profile`
- `/worker-dashboard`
- `/contractor-profile`
- `/contractor-dashboard`
- `/job-matches/:jobId`
