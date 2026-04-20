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
│   │   │   └── skills/
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

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm 10+

## Setup

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_URL` in `backend/.env` to your PostgreSQL instance.

### 3) Run database migration

Apply:

```bash
psql "$DATABASE_URL" -f backend/src/db/migrations/001_workforce_profiles.sql
```

### 4) Run development servers

In terminal 1:

```bash
cd backend
npm run dev
```

In terminal 2:

```bash
cd frontend
npm run dev
```

## Workforce API

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

### Shared endpoints
- `GET /api/skills`
- `GET /api/health`

## Frontend Pages

- `/login`
- `/register`
- `/worker-profile`
- `/contractor-profile`

The worker profile page includes add/remove skill UI fed by `GET /api/skills`.
