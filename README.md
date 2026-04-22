# OMNAS Assembler

A modular full-stack construction workforce management platform with:
- **Backend:** Node.js + Express + PostgreSQL (`pg`)
- **Frontend:** React + Vite + React Router

## Project Structure

```text
OMNAS-Core/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/migrations/          # 001–017
│   │   ├── infrastructure/
│   │   │   ├── clients/            # samGovClient
│   │   │   └── events/             # canonical eventBus singleton
│   │   ├── middleware/
│   │   ├── modules/
│   │   │   ├── actions/
│   │   │   ├── analytics/
│   │   │   ├── assembler/
│   │   │   ├── assignments/
│   │   │   ├── calendar/
│   │   │   ├── contractors/
│   │   │   ├── dashboard/
│   │   │   ├── escalations/
│   │   │   ├── financial/
│   │   │   ├── jobs/
│   │   │   ├── logs/
│   │   │   ├── matching/
│   │   │   ├── opportunities/
│   │   │   ├── recommendations/
│   │   │   ├── reliability/
│   │   │   ├── scheduling/
│   │   │   ├── skills/
│   │   │   └── workers/
│   │   ├── orchestrator/
│   │   │   ├── handlers/           # calendar.handler, ghost.handler
│   │   │   ├── eventBus.js         # bridge → infrastructure/events
│   │   │   └── registerHandlers.js
│   │   ├── routes/                 # auth, health
│   │   ├── shared/
│   │   │   └── pca/taxonomy/       # tradeIntelligence + adjacency data
│   │   ├── utils/
│   │   ├── workers/
│   │   │   └── ghostWatcher.js     # ghost detection loop
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

Apply migrations in order (001–017):

```bash
for f in backend/src/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Or individually from `001_workforce_profiles.sql` through `017_dispatch_orchestrator.sql`.

Run apps:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## API

Authentication is mocked via headers for local development:
- `x-user-id: <uuid>`
- `x-user-role: worker | contractor | superintendent | client`

### Worker endpoints (`x-user-role: worker`)
- `PUT /api/workers/profile`
- `GET /api/workers/profile`
- `POST /api/workers/skills`
- `DELETE /api/workers/skills/:skillId`

### Contractor endpoints (`x-user-role: contractor`)
- `PUT /api/contractors/profile`
- `GET /api/contractors/profile`

### Reliability
- `GET /api/workers/:id/reliability`

### Jobs endpoints
- `POST /api/jobs` (contractor only)
- `GET /api/jobs`
- `GET /api/jobs/:id`
- `PATCH /api/jobs/:id` (contractor only)
- `DELETE /api/jobs/:id` (contractor only)
- `GET /api/jobs/:id/matches` (contractor only)
- `GET /api/jobs/:id/recommendations` (contractor only)
- `GET /api/jobs/:id/scheduling`
- `GET /api/jobs/:id/financial`
- `GET /api/jobs/:id/command` (analytics — full project command)
- `GET /api/jobs/:id/financial` (analytics — financial snapshot)
- `GET /api/jobs/:id/snapshot` (analytics — activity snapshot)
- `GET /api/jobs/:id/dashboard` (aggregation dashboard)
- `POST /api/jobs/:id/autofill` (assembler — auto-fill open slots)

### Assignments endpoints
- `POST /api/assignments` (contractor only)
- `PATCH /api/assignments/:id/accept` (worker only)
- `PATCH /api/assignments/:id/decline` (worker only)
- `PATCH /api/assignments/:id/start` (worker only)
- `PATCH /api/assignments/:id/complete`
- `GET /api/assignments/:id`
- `GET /api/assignments`

### Daily logs endpoints
- `POST /api/assignments/:id/logs` (worker only)
- `GET /api/assignments/:id/logs`
- `GET /api/logs/:id`

### Opportunities endpoints
- `POST /api/opportunities/fetch`
- `POST /api/opportunities/normalize`
- `POST /api/opportunities/enrich`
- `GET /api/opportunities/ready`
- `POST /api/opportunities/:id/import`

### Calendar
- `GET /api/calendar`
- `POST /api/calendar`

### Escalations
- `GET /api/escalations`
- `POST /api/escalations`

### Actions
- `GET /api/actions`
- `POST /api/actions`

### Shared
- `GET /api/skills`
- `GET /api/health`

## Frontend Pages

- `/login`
- `/register`
- `/worker-profile`
- `/worker-dashboard`
- `/contractor-profile`
- `/contractor-dashboard`
- `/opportunities`
- `/job-matches/:jobId`

## Background Workers

- **ghostWatcher** — scans accepted assignments past start threshold; emits `ON_GHOST_DETECTED`
- **dispatchWorker** — expires stale offers and triggers vacancy refill
