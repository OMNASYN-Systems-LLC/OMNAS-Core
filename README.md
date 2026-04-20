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
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
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

Create `.env` files from examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_URL` in `backend/.env` to your PostgreSQL instance.

### 3) Run development servers

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

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health endpoint: `GET http://localhost:4000/api/health`

## Available API Endpoints

- `POST /api/auth/register`
  - body: `{ "name": "...", "email": "...", "password": "..." }`
- `POST /api/auth/login`
  - body: `{ "email": "...", "password": "..." }`
- `GET /api/health`

## Production Notes

- Environment variables are validated on startup.
- Security middleware includes `helmet`, `cors`, and request logging.
- Backend code is organized by config/routes/controllers/services for scalability.
- Frontend is route-driven and API calls are isolated in a service module.
