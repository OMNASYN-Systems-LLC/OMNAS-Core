# OMNAS — Roddy Engineering Brief
**As of: 2026-05-04 | Branch: main | Latest Commit: 7c15075**

---

## PART 1 — REPOSITORY AUDIT

### Branch & Commit State

| Item | Value |
|------|-------|
| Default branch | `main` |
| Latest commit | `7c15075` — Merge PR #16: fix(register): make backend call non-fatal in pilot mode |
| Last merged | 2026-04-25 |
| Active dev branches | `internal-alpha-v0.1`, `internal-alpha-v0.1-hotfix-login` |
| Total PRs merged to main | 16 |

---

### Directory Structure

```
OMNAS-Core/
├── backend/
│   └── src/
│       ├── app.js                        ← Express app, route mounting, registerHandlers()
│       ├── server.js                     ← HTTP server entry
│       ├── clients/                      ← samGovClient (SAM.gov API integration)
│       ├── config/                       ← DB config
│       ├── controllers/                  ← Top-level controllers (analytics stub)
│       ├── db/
│       │   └── migrations/               ← 21 SQL migrations (000–020)
│       ├── infrastructure/
│       │   └── events/eventBus.js        ← Canonical shared EventEmitter
│       ├── middleware/
│       │   ├── authContext.js            ← Header-based auth (x-user-id, x-user-role) — MOCK
│       │   └── errorHandler.js
│       ├── modules/
│       │   ├── actions/                  ← Draft directive system (mock SMS)
│       │   ├── analytics/                ← Stub — broken controllers removed in hotfix
│       │   ├── assembler/                ← Auto-fill engine (3-tier slot filling)
│       │   ├── assignments/              ← Full lifecycle + compliance gates
│       │   ├── calendar/                 ← Shift block creation from accepted assignments
│       │   ├── compliance/               ← Company state, credential validation, enforcement
│       │   ├── contractors/              ← Contractor profiles
│       │   ├── dashboard/                ← Job dashboard aggregation API
│       │   ├── escalations/              ← Escalation events + resolution
│       │   ├── financial/                ← Exists — scope partial/unclear
│       │   ├── jobs/                     ← Job CRUD + ghost recovery metadata
│       │   ├── logs/                     ← Daily logs + voice logs
│       │   ├── matching/                 ← Worker-job scoring with cache
│       │   ├── opportunities/            ← SAM.gov fetch/normalize/enrich/import
│       │   ├── pca/                      ← Exists — purpose undocumented in commits
│       │   ├── recommendations/          ← Exists — scope partial
│       │   ├── reliability/              ← 5-signal worker reliability score
│       │   ├── scheduling/               ← AT_RISK advisory, MFVP markers
│       │   ├── skills/                   ← Skills CRUD
│       │   ├── triage/                   ← Triage query layer
│       │   └── workers/                  ← Worker profiles
│       ├── orchestrator/
│       │   ├── eventBus.js               ← Bridge re-export (backward compat)
│       │   ├── registerHandlers.js       ← Wires all event handlers at startup
│       │   └── handlers/
│       │       ├── ghost.handler.js      ← ON_GHOST_DETECTED recovery
│       │       ├── calendar.handler.js   ← ON_ASSIGNMENT_ACCEPTED → shift block
│       │       └── compliance.handler.js ← ON_COMPANY_ACTIVATED/SUSPENDED, ON_CREDENTIAL_EXPIRED
│       ├── routes/                       ← Legacy/shared route files
│       ├── services/                     ← Auth service stub
│       ├── shared/                       ← Validation scaffold
│       ├── utils/
│       └── workers/
│           └── ghostWatcher.js           ← Polling worker: marks ghosted assignments, emits ON_GHOST_DETECTED
└── frontend/
    └── src/
        ├── main.jsx
        ├── styles.css
        ├── hooks/
        │   └── useAuth.js                ← localStorage session store
        ├── router/                       ← AuthLayout with role-gated nav
        ├── services/
        │   └── api.js                    ← All backend calls incl. getTriageSummary, getTriageBlockLog
        ├── components/
        │   └── CommandTab, ActionPanel, StatusBadge, etc.
        └── pages/
            ├── LoginPage.jsx             ← localStorage auth, role-based redirect
            ├── RegisterPage.jsx          ← Role dropdown, user store
            ├── WorkerProfilePage.jsx
            ├── WorkerDashboardPage.jsx   ← Assignment view, log submission
            ├── ContractorProfilePage.jsx
            ├── ContractorDashboardPage.jsx
            ├── JobDetailPage.jsx         ← Dashboard aggregation + directive send
            ├── MatchesPage.jsx
            ├── OpportunitiesPage.jsx     ← SAM.gov pipeline UI
            └── PivotDashboardPage.jsx    ← Superintendent triage (30s poll, LOCKED/ALERTS/GHOST)
```

---

### Database Migrations (21 total)

| # | File | What it creates |
|---|------|-----------------|
| 000 | users_foundation | `users` table (FK anchor) |
| 001 | workforce_profiles | `worker_profiles`, `contractor_profiles` |
| 002 | jobs | `jobs` table |
| 003 | matching | `match_scores` |
| 004 | assignments | `assignments` (lifecycle status enum) |
| 005 | daily_logs | `daily_logs` |
| 006–008 | opportunities | `opportunities` (raw → normalized → enriched) |
| 009 | opportunity_import_jobs | `opportunity_import_jobs` |
| 010 | match_scores_performance | index additions |
| 011 | field_execution_engine | schedule/execution fields on jobs |
| 012 | escalation_events | `escalation_events` |
| 013 | profit_erosion_engine | profit/cost tracking tables |
| 014 | directives | `directives` (draft dispatch) |
| 015 | worker_reliability | `reliability_score` column on worker_profiles |
| 016 | calendar_foundation | `calendar_blocks`, `shift_blocks` |
| 017 | dispatch_orchestrator | `dispatch_queue`, `urgency_state` |
| 018 | company_foundation | `contractor_companies`, `worker_affiliations` |
| 019 | worker_credentials | `worker_credentials` (expirable certs/licenses) |
| 020 | compliance_enforcement | `company_compliance_states`, `company_compliance_history`, `audit_block_log` |

**Total tables: ~24**

---

### Backend API Surface (current main)

**Workers**
- `GET/PUT /api/workers/profile`
- `POST/DELETE /api/workers/skills/:skillId`
- `GET /api/workers/:id/reliability`

**Contractors**
- `GET/PUT /api/contractors/profile`

**Jobs**
- `GET/POST /api/jobs`
- `GET/PATCH/DELETE /api/jobs/:id`
- `GET /api/jobs/:id/matches`
- `GET /api/jobs/:id/dashboard` ← aggregation endpoint
- `POST /api/jobs/:id/autofill` ← assembler

**Assignments**
- `POST /api/assignments` (create offered)
- `PATCH /api/assignments/:id/accept` ← compliance-gated
- `PATCH /api/assignments/:id/decline`
- `PATCH /api/assignments/:id/start`
- `PATCH /api/assignments/:id/complete`
- `GET /api/assignments/:id`
- `GET /api/assignments`

**Logs**
- `POST /api/assignments/:id/logs`
- `GET /api/assignments/:id/logs`
- `GET /api/logs/:id`

**Compliance**
- `GET /api/compliance/companies`
- `GET /api/compliance/companies/:id`
- `PATCH /api/compliance/companies/:id`
- `GET /api/compliance/companies/:id/history`

**Dashboard / Triage**
- `GET /api/dashboard/triage` ← LOCKED_JOBS, COMPLIANCE_ALERTS, GHOST_EVENTS
- `GET /api/dashboard/triage/blocks/:entityType/:entityId`

**Escalations**
- `GET /api/escalations`
- `PATCH /api/escalations/:id/status`

**Actions (Directives)**
- `POST /api/actions/draft`
- `GET /api/actions?jobId=`
- `PATCH /api/actions/:id/status`

**Calendar**
- `GET/POST /api/calendar`

**Opportunities**
- `POST /api/opportunities/fetch`
- `POST /api/opportunities/normalize`
- `POST /api/opportunities/enrich`
- `GET /api/opportunities/ready`
- `POST /api/opportunities/:id/import`

**Skills**
- `GET /api/skills`

**Health**
- `GET /api/health`

---

### Infrastructure & Event System

**Event Bus**: Single `EventEmitter` instance at `infrastructure/events/eventBus.js`. Bridged to `orchestrator/eventBus.js` for backward compat.

**Registered Events & Handlers:**

| Event | Handler | What happens |
|-------|---------|--------------|
| `ON_GHOST_DETECTED` | `ghost.handler.js` | idempotency check → setReplacementLock → markRiskState(AT_RISK) → runAutofill(EMERGENCY) |
| `ON_ASSIGNMENT_ACCEPTED` | `calendar.handler.js` | createShiftBlockFromAssignmentEvent |
| `ON_COMPANY_ACTIVATED` | `compliance.handler.js` | resolve pending suspension escalations |
| `ON_COMPANY_SUSPENDED` | `compliance.handler.js` | per-assignment escalation + audit_block_log |
| `ON_CREDENTIAL_EXPIRED` | `compliance.handler.js` | AMBER escalation + audit_block_log |

**Background Workers:**
- `ghostWatcher.js` — polls for assignments that have gone silent past window, marks `GHOSTED`, emits `ON_GHOST_DETECTED`

---

### Auth State (Critical Gap)

| Layer | Current State |
|-------|--------------|
| Backend | Header mocks only: `x-user-id`, `x-user-role`. No JWT, no session. |
| Frontend | `localStorage` user store. Role-based redirect. No token validation. |
| Production-readiness | **Not production auth.** Acceptable for internal alpha/pilot only. Must be replaced before any external user touches the system. |

---

### Known Module Gaps in Current Code

- `analytics/` — controllers for financial snapshot and job activity snapshot were removed (undefined references). Module is a stub.
- `financial/` — table exists (migration 013), module folder exists, but endpoint depth unclear.
- `pca/` — folder exists, no commit message explains scope. Likely Preconstruction/Procurement Cost Analysis.
- `recommendations/` — folder exists, depth unclear.
- No test files present anywhere in the repo.
- No CI/CD configuration (no GitHub Actions, no Dockerfile).
- README is outdated — only documents migrations 001–010.

---

## PART 2 — CORE MVP DEFINITION

**Definition: Construction Governance + Execution Control**

The Core MVP answers one question for a superintendent or GC:
> *Can this worker, from this company, show up and work on this assignment today — and if something goes wrong, do I know about it immediately?*

### Core MVP Components

| Component | What it does | Status in repo |
|-----------|-------------|----------------|
| **Company compliance state** | PENDING / ACTIVE / SUSPENDED per company. Governs whether any worker from that company can accept or check in. | BUILT — migration 020, compliance module |
| **Worker credential validation** | Tracks expirable certs/licenses per worker. Blocks check-in on expired credentials. | BUILT — migration 019, compliance service |
| **Assignment lifecycle** | offered → accepted → started → completed / ghosted. Full state machine. | BUILT — assignments module |
| **Assignment accept/block** | checkAcceptanceEligibility called before every accept. Blocks if company ≠ ACTIVE. | BUILT — assignments/service.js gate |
| **Check-in gating** | checkCheckinEligibility on daily log submit. Blocks on SUSPENDED company or expired credentials. | BUILT — logs/service.js gate |
| **Ghost detection** | ghostWatcher polls for silent assignments. Marks GHOSTED, fires emergency autofill. | BUILT — ghostWatcher.js + ghost.handler.js |
| **Audit log** | audit_block_log records every hard block with entity, reason, timestamp. | BUILT — migration 020, compliance/repository.js |
| **Triage dashboard** | PivotDashboardPage: LOCKED_JOBS / COMPLIANCE_ALERTS / GHOST_EVENTS, 30s refresh, escalation queue. | BUILT — frontend + /api/dashboard/triage |

### What Core MVP Does NOT include (by design)

- Payments or payroll of any kind
- Marketplace matching or vendor browsing
- SAM.gov procurement pipeline
- Financial P&L tracking (tables exist but not MVP scope)
- Scheduling intelligence / CPM
- RFI / submittals
- Owner/client transparency portal
- Mobile app or native check-in
- Real push notifications (directives still mock SMS)

---

## PART 3 — MASTER FEATURE LIST vs. ROADMAP PHASE

| Feature Area | Specific Capability | Classification | In Repo? |
|---|---|---|---|
| **Execution governance** | Company compliance state (PENDING/ACTIVE/SUSPENDED) | CORE MVP | YES |
| | Worker credential validation + expiry gates | CORE MVP | YES |
| | Assignment accept/block enforcement | CORE MVP | YES |
| | Check-in gating | CORE MVP | YES |
| | Ghost detection + emergency autofill trigger | CORE MVP | YES |
| | Audit block log | CORE MVP | YES |
| | Superintendent triage dashboard | CORE MVP | YES |
| | Escalation resolution workflow | CORE MVP | YES |
| | Worker reliability scoring | CORE MVP | YES |
| | Real authentication (JWT/OAuth) | CORE MVP | **MISSING** |
| | Worker credential entry UI | CORE MVP | **MISSING** |
| | Company onboarding / registration flow | CORE MVP | **MISSING** |
| | Check-in UI (worker-facing) | CORE MVP | **MISSING** |
| | Compliance block feedback to worker UI | CORE MVP | **MISSING** |
| | Superintendent manual override UI | CORE MVP | **MISSING** |
| **Scheduling intelligence** | AT_RISK marker / MFVP advisory | CORE MVP (partial) | YES (advisory only) |
| | CPM / critical path resequencing | ALPHA/BETA | No |
| | Ripple delay estimation | ALPHA/BETA | Schema only |
| | Shift calendar block creation | ALPHA/BETA | YES |
| | Urgency engine / dispatch queue | ALPHA/BETA | YES |
| **Preconstruction / procurement** | SAM.gov fetch → normalize → enrich → import | ALPHA/BETA | YES |
| | Manual opportunity creation | ALPHA/BETA | Partial |
| | Bid package assembly | PHASE 2 | No |
| | Subcontractor scope assignment | PHASE 2 | No |
| **RFP parsing** | Document ingestion + structured extraction | PHASE 2 | No |
| | AI-assisted scope mapping | PHASE 2 | No |
| **RFIs / submittals** | RFI creation + routing | PHASE 2 | No |
| | Submittal log + approval chain | PHASE 2 | No |
| | Owner/architect review loop | PHASE 2 | No |
| **Marketplace** | Static contractor/vendor card display | ALPHA/BETA (demo) | No |
| | Trade/category filters | ALPHA/BETA (demo) | No |
| | Compliance badge display | ALPHA/BETA (demo) | No |
| | Request match / invite subcontractor buttons | ALPHA/BETA (demo) | No |
| | Opportunity/job package view | ALPHA/BETA (demo) | No |
| | Real matching + contract award | PHASE 2 | No |
| | 1% finder fee model | PHASE 2 | No |
| **Financial / payments** | Profit erosion tracking (schema) | ALPHA/BETA | Schema only |
| | Worker pay calculations | PHASE 2 | No |
| | GC invoice generation | PHASE 2 | No |
| | Stripe / ACH integration | PHASE 2 | No |
| | Retainage management | FUTURE | No |
| **Clutch logistics** | Material delivery coordination | FUTURE / UNICORN | No |
| | Equipment tracking | FUTURE / UNICORN | No |
| | Last-mile site logistics | FUTURE / UNICORN | No |
| **AFLO** | Worker financial account layer | FUTURE / UNICORN | No |
| | TREE wallet | FUTURE / UNICORN | No |
| | Earned wage access | FUTURE / UNICORN | No |
| **BBU / benefits** | Worker benefits enrollment | FUTURE / UNICORN | No |
| | Health/dental/vision portability | FUTURE / UNICORN | No |
| **Insurance / bonding** | Certificate of insurance tracking | PHASE 2 | No |
| | Bond requirement validation | PHASE 2 | No |
| | Insurance expiry gating | PHASE 2 (extend cred system) | No |
| **Email / M365 integrations** | Outlook calendar sync | PHASE 2 | No |
| | Teams notification dispatch | PHASE 2 | No |
| | Email directive delivery (replace mock SMS) | ALPHA/BETA | No |
| **Design / code intelligence** | Drawing/spec ingestion | FUTURE | No |
| | Quantity takeoff automation | FUTURE | No |
| | Change order detection | FUTURE | No |
| **Owner / client transparency** | Project status portal (read-only) | PHASE 2 | No |
| | Budget vs. actual view | PHASE 2 | No |
| | Milestone reporting | PHASE 2 | No |

---

## PART 4 — MARKETPLACE DEMO POSITIONING

### What to build — demo scope only

The marketplace demo is a **read-only, seeded showcase** to show investors and partners the eventual business model. It must not require real users, real payments, or real contract awards.

**Build this:**

| Component | Implementation |
|-----------|---------------|
| Contractor / vendor cards | Seeded static data: 8–12 sample companies with trade, location, headcount |
| Trade / category filter | Client-side filter on seeded array — no backend needed |
| Compliance badges | Pull from `contractor_companies` + `company_compliance_states` if available; otherwise seed static |
| "Request match" button | Fires a toast: "Match request submitted — OMNAS team will follow up." No backend call. |
| "Invite subcontractor" button | Same — toast only. |
| Opportunity / job package view | Single read-only detail card showing scope, trade, location, timeline |
| Business model callout | Static explainer block: "OMNAS earns 1% of awarded contract value as a finder fee" |

**Do not build:**
- Any payment capture
- Real contract award flow
- Material purchasing or logistics
- AFLO / TREE wallet
- Legal fee capture
- Matching algorithm integration at this stage
- Anything that stores real vendor PII

**Where it lives:**
- Route: `/marketplace` — gated behind auth, accessible to GC/superintendent role
- Single new page: `MarketplaceDemoPage.jsx`
- One seed file or hardcoded array in the component
- Zero new backend routes required

**Why this works:**
It shows the vision, confirms the business model for investor conversations, and does not pull engineer time away from the Core MVP critical path. It can be built in parallel by a single engineer in 2–3 days.

---

## PART 5 — ROADMAP

---

### Phase 0 — Current State
**As of 2026-05-04**

**Objective:** Understand exactly where we are before locking scope.

**What is built:**
- Company compliance state machine (ACTIVE/PENDING/SUSPENDED)
- Worker credential table + expiry tracking
- Assignment lifecycle with compliance enforcement gates on accept and check-in
- Ghost detection + event-driven emergency autofill
- Audit block log
- Superintendent triage dashboard (PivotDashboardPage, 30s polling)
- Escalation events + resolution
- Worker reliability scoring
- Auto-fill engine (3-tier)
- Dashboard aggregation API
- Calendar shift blocks
- Dispatch urgency engine
- SAM.gov opportunity pipeline (fetch/normalize/enrich/import)
- Worker + contractor profiles
- Skills management
- Matching engine with score cache
- Draft directive system (mock SMS)
- React SPA with role-based routing
- 21 SQL migrations producing ~24 tables

**What is missing:**
- Real authentication (no JWT/OAuth — header mocks only)
- Worker credential entry UI
- Company onboarding flow
- Check-in worker UI (log submission exists but no dedicated check-in flow)
- Compliance block feedback to worker (worker doesn't know why they're blocked)
- Superintendent manual override UI
- Real notification delivery (mock SMS only)
- Test suite (zero tests anywhere)
- CI/CD pipeline
- Deployment configuration
- Updated README

**Acceptance criteria for Phase 0 complete:**
- This document reviewed and signed off by Roddy
- All gaps above acknowledged and assigned to a phase

---

### Phase 1 — Core MVP Lock
**Target: 2–3 weeks**

**Objective:** Make the governance and execution control loop fully operational end-to-end. A superintendent can onboard a company, assign workers, see compliance blocks, and respond to ghost events — all through the UI.

**Required features:**

1. **Real authentication**
   - Replace header mock with JWT-based auth
   - Login issues a signed token stored in `localStorage` (or httpOnly cookie)
   - `authContext.js` validates JWT on every request
   - Registration creates a real user record in `users` table
   - Roles: `worker`, `contractor`, `superintendent`, `admin`

2. **Company onboarding UI**
   - Contractor can register their company (name, trade, location, license number)
   - Creates record in `contractor_companies`
   - Initial state: PENDING → admin/superintendent activates → ACTIVE
   - Worker can affiliate with a company (creates `worker_affiliations` record)

3. **Worker credential entry UI**
   - Worker can add credentials: type, issuer, issued date, expiry date
   - Writes to `worker_credentials` table
   - Expired credential shown as warning badge on worker profile
   - Dashboard triage reflects expired credential immediately

4. **Check-in worker UI**
   - Dedicated "Check In" button on WorkerDashboardPage for active assignments
   - Calls `POST /api/assignments/:id/logs` with check-in payload
   - If blocked by compliance: show reason (e.g., "Your company is suspended — contact your superintendent")
   - Not a mobile native flow — web only for now

5. **Compliance block feedback**
   - When assignment accept or check-in is blocked, API returns structured error with `block_reason` code
   - Frontend maps reason codes to human-readable messages
   - Worker sees: "Cannot accept — your company (ABC Masonry) is currently suspended"

6. **Superintendent override UI**
   - In PivotDashboardPage: escalation items have a "Resolve / Override" action
   - Calls `PATCH /api/escalations/:id/status`
   - Records override in `company_compliance_history` via compliance service

7. **Audit log viewer**
   - Simple table in superintendent view: entity, block reason, timestamp, resolved by
   - Calls `GET /api/dashboard/triage/blocks/:entityType/:entityId`

8. **Real notification dispatch**
   - Replace mock SMS in `actions/service.js` with email (SendGrid or Resend — one provider, simple)
   - Directive: superintendent sends recommendation → worker gets email
   - No SMS required at this phase

**What is already built that maps here:**
- All compliance enforcement gates (backend — complete)
- Assignment lifecycle (backend — complete)
- Ghost detection + autofill (backend — complete)
- Triage dashboard (frontend — complete)
- Escalation resolution (backend — complete, frontend partial)
- Audit block log (backend — complete, frontend missing)

**What is missing (build list):**
- JWT auth (backend + frontend)
- Company onboarding page + API
- Worker affiliate to company page + API
- Credential entry page + API PUT
- Check-in UI on WorkerDashboardPage
- Block reason error mapping in frontend
- Override button wiring in PivotDashboardPage
- Audit log table UI
- SendGrid/Resend integration in actions/service.js

**What NOT to build yet:**
- Payments
- Scheduling CPM
- Owner portal
- Marketplace (except demo — parallelizable)
- Mobile app

**Acceptance criteria for Phase 1 complete:**
- A superintendent can create a company record and activate it
- A worker can affiliate with a company and enter credentials
- A worker with an expired credential cannot check in; they see the reason
- A worker from a suspended company cannot accept an assignment; they see the reason
- A superintendent sees all LOCKED_JOBS, COMPLIANCE_ALERTS, and GHOST_EVENTS in the triage dashboard
- A superintendent can resolve an escalation from the UI
- The audit log shows the block history for any entity
- Ghost events fire automated autofill; superintendent sees replacement status
- All of the above works end-to-end against a real PostgreSQL database
- No header mocks in use

---

### Phase 2 — Internal Alpha
**Target: 4–6 weeks after Phase 1**

**Objective:** Controlled internal use on real projects with real data. System proves it can run a job site for 30 days without manual intervention.

**Required features:**

- Scheduling intelligence: per-job critical path advisory (not full CPM — just AT_RISK propagation with estimated delay)
- Real-time notification: directive email confirmed delivered and responded to
- Worker mobile web: responsive design for WorkerDashboardPage (no native app — PWA-compatible layout)
- Financial snapshot: job P&L view for contractor (uses migration 013 profit_erosion_engine)
- Analytics: restore analytics module — daily active workers, logs submitted, ghost rate per job
- Dispatch queue: superintendent can manually trigger autofill for a job
- Opportunity import: SAM.gov pipeline tested with real API key and real data
- Seed data scripts for clean test environments

**What to ignore:**
- RFIs, submittals, owner portal
- Marketplace real matching
- Insurance/bonding beyond credential field
- Payments

**Acceptance criteria:**
- 5 internal users operating the system for 30 days on simulated project data
- Ghost rate tracked and visible
- Zero data loss or corruption events
- P50 API response time under 300ms on triage and dashboard endpoints

---

### Phase 3 — Controlled Beta / Pilot
**Target: 6–10 weeks after Alpha**

**Objective:** 3–5 external GC or subcontractor companies using OMNAS on real job sites. Prove the governance loop holds under real conditions.

**Required features:**

- Multi-tenant isolation: company data scoped correctly, no cross-tenant data leak
- SOC 2 readiness groundwork: audit logging complete, access controls documented
- Worker mobile web: fully responsive — workers can check in from phone browser
- Real payment capture: Stripe Connect for contractor billing (subscription or per-seat)
- Insurance/bonding credential type support: COI upload + expiry gating (extends worker_credentials model)
- Superintendent role hardening: separate superintendent account type distinct from contractor
- SLA alerting: if triage LOCKED_JOBS count exceeds threshold, send superintendent email
- Basic reporting: downloadable PDF or CSV of audit log, compliance history, ghost events

**What to ignore:**
- CPM / scheduling intelligence (full)
- Marketplace real matching
- RFP parsing
- Clutch logistics
- AFLO/BBU

**Acceptance criteria:**
- 3 external companies onboarded, credentialed, running active jobs
- Zero critical data exposure events
- Compliance enforcement demonstrably blocks at least one real non-compliant event
- System survives one external company being suspended and reactivated without data corruption

---

### Phase 4 — Market Entry
**Target: After Pilot signoff**

**Objective:** Open access to qualified GC and subcontractor companies. OMNAS generates revenue.

**Required features:**

- Self-serve onboarding: company can register, invite workers, and go live without manual OMNAS intervention
- Stripe subscription billing: tiered (per seat or per project)
- Compliance verification integration: SAM.gov, state contractor license lookups
- Owner/client read-only portal: project status, milestone completion, compliance summary
- Full analytics: job completion rate, worker utilization, ghost rate trends
- Email + calendar integration: Outlook/Google Calendar sync for shift blocks

**What to ignore:**
- Marketplace real matching (Phase 5)
- Clutch, AFLO, BBU (Phase 6)

---

### Phase 5 — Marketplace Demo → Real Marketplace
**Target: Parallel to Phase 4, activated at Market Entry**

**Phase 5a (Demo — build now, low effort):**
- Static seeded vendor cards, trade filters, compliance badges
- "Request match" and "Invite subcontractor" buttons (toast only)
- Business model explainer callout
- Route: `/marketplace`
- Estimated build: 2–3 engineer-days

**Phase 5b (Real Marketplace — post Market Entry):**
- Live contractor/vendor profiles from real `contractor_companies` data
- OMNAS-verified compliance badges pulled from `company_compliance_states`
- Request match → OMNAS matching engine → ranked results
- 1% finder fee: captured at contract award via Stripe
- Subcontractor invitation flow → assignment creation → governance loop applies
- Estimated build: 8–12 weeks

---

### Phase 6 — Full Ecosystem / Unicorn Roadmap
**No timeline set — long horizon**

These features are real and valuable but have zero dependency on Core MVP. Do not let them consume any engineering bandwidth until Phase 4 is proven.

| Feature | What it is |
|---------|-----------|
| **Clutch logistics** | Material delivery coordination, equipment tracking, site-level last-mile logistics |
| **AFLO** | Worker financial account layer — earned wage access, TREE wallet, benefits portability |
| **BBU** | Portable benefits (health, dental, vision) for 1099 construction workers |
| **CPM scheduling** | Full critical path method integration — ripple delay calculation across project network |
| **RFP parsing** | AI document ingestion → structured scope extraction → job creation |
| **RFIs / submittals** | Full RFI + submittal routing with architect/engineer loop |
| **Design intelligence** | Drawing/spec ingestion, quantity takeoff, change order detection |
| **Insurance/bonding automation** | Real-time COI verification via API, bond requirement auto-check |
| **M365 deep integration** | SharePoint, Teams, Power BI reporting connectors |

---

## PART 6 — RODDY ENGINEERING BRIEF

---

### What to Review First

These files are the backbone. Read them before touching anything else.

```
backend/src/app.js                          ← Route mount order, registerHandlers() call
backend/src/orchestrator/registerHandlers.js ← All events and their handlers
backend/src/modules/compliance/service.js   ← The two gate functions — checkAcceptanceEligibility, checkCheckinEligibility
backend/src/modules/assignments/service.js  ← Where acceptance gate is called
backend/src/modules/logs/service.js         ← Where check-in gate is called
backend/src/workers/ghostWatcher.js         ← Polling logic — interval, detection window
backend/src/modules/dashboard/             ← /api/dashboard/triage aggregation
frontend/src/pages/PivotDashboardPage.jsx  ← Superintendent command center
frontend/src/hooks/useAuth.js              ← Current auth state — this gets replaced with JWT
frontend/src/services/api.js               ← Every API call the frontend makes
```

---

### What to Merge / Incorporate

Do not create new branches for MVP work unless rebasing. Work directly on `main` or cut a `mvp/phase-1` branch off main.

**The following are already merged to main and solid — do not rewrite:**
- `claude/enforce-company-governance-F549T` (PR #8) — compliance module
- `claude/dashboard-aggregation-layer-GK2d7` (PR #7) — dashboard API
- `claude/stress-test-pilot-signoff-ImM9t` (PR #9) — auth wiring, triage UI
- `claude/deploy-omnas-alpha-nXwDI` (PR #12, #16) — login/register non-fatal backend

**The `internal-alpha-v0.1` branch** — verify what's on it that didn't make it to main. If it diverged, cherry-pick or merge carefully.

---

### Endpoints That Matter Most for Core MVP

These are the endpoints that gate real business logic. They must work correctly under all conditions.

| Priority | Endpoint | Why it matters |
|----------|----------|----------------|
| P0 | `PATCH /api/assignments/:id/accept` | Compliance gate — must block non-ACTIVE company workers |
| P0 | `POST /api/assignments/:id/logs` | Check-in gate — must block on expired credentials |
| P0 | `GET /api/dashboard/triage` | Superintendent's only view into system state |
| P0 | `PATCH /api/escalations/:id/status` | Only way superintendent can resolve a block |
| P1 | `GET /api/dashboard/triage/blocks/:entityType/:entityId` | Audit trail drilldown |
| P1 | `PATCH /api/compliance/companies/:id` | Activating or suspending a company |
| P1 | `POST /api/jobs/:id/autofill` | Emergency ghost recovery trigger |
| P2 | `GET /api/jobs/:id/dashboard` | Per-job execution confidence + risk |
| P2 | `GET /api/workers/:id/reliability` | Worker reliability profile |

---

### What to Ignore for Now

Do not touch these until Phase 2 or later:

- `backend/src/modules/opportunities/` — SAM.gov pipeline works but is not MVP critical path
- `backend/src/modules/pca/` — unclear scope, do not expand
- `backend/src/modules/financial/` — schema exists, don't build UI yet
- `backend/src/modules/scheduling/` — AT_RISK advisory is fine as-is; do not expand to CPM
- `backend/src/modules/analytics/` — broken stub; leave it broken until Alpha
- `backend/src/modules/recommendations/` — unclear scope, ignore
- `backend/src/clients/samGovClient.js` — don't add features
- `frontend/src/pages/OpportunitiesPage.jsx` — not MVP
- `frontend/src/pages/MatchesPage.jsx` — not MVP
- Anything related to Clutch, AFLO, BBU, CPM, RFI, submittals

---

### 7-Day Priority List

| Day | Task | Touches |
|-----|------|---------|
| 1 | Audit `internal-alpha-v0.1` — identify any unreleased work vs. main | Git |
| 1 | Set up local environment: Postgres + backend + frontend — verify all 21 migrations apply cleanly | Dev env |
| 2 | Replace `authContext.js` header mock with JWT middleware (jsonwebtoken + verify) | `middleware/authContext.js`, `services/auth.js` |
| 2 | LoginPage and RegisterPage: issue JWT on login, store in localStorage, send as Bearer token | `LoginPage.jsx`, `RegisterPage.jsx`, `api.js` |
| 3 | Build `POST /api/companies` (create company) and `POST /api/companies/:id/activate` | New route in `compliance/routes.js` or new module |
| 3 | Build `POST /api/workers/affiliate` (worker joins company) | `workers/routes.js` |
| 4 | Build `GET/POST /api/workers/credentials` UI-facing endpoints | Extend `workers` or `compliance` module |
| 4 | Build WorkerCredentialForm — add credential type, dates, displays expiry warning | New component |
| 5 | Build CompanyOnboardingPage — contractor registers company, sees PENDING state | New page |
| 5 | Wire company affiliation into RegisterPage or new AffiliationPage | `RegisterPage.jsx` or new |
| 6 | Add block_reason to assignment accept and log submit 400 responses | `assignments/service.js`, `logs/service.js` |
| 6 | Map block_reason codes to UI messages in WorkerDashboardPage | `WorkerDashboardPage.jsx` |
| 7 | Wire "Resolve" button in PivotDashboardPage to `PATCH /api/escalations/:id/status` | `PivotDashboardPage.jsx` |
| 7 | Add basic audit log table to PivotDashboardPage — calls `/triage/blocks/` | `PivotDashboardPage.jsx` |

---

### 30-Day Priority List

| Week | Focus | Deliverable |
|------|-------|-------------|
| Week 1 | Auth + company onboarding | JWT works, companies can be created and activated |
| Week 1 | Worker credential UI | Workers can enter certs, see expiry warnings |
| Week 2 | Check-in UX | Worker sees clear block reason when denied |
| Week 2 | Superintendent overrides | Escalation resolution wired end-to-end |
| Week 2 | Audit log viewer | Superintendent can see block history |
| Week 3 | Notification (email) | Replace mock SMS — SendGrid or Resend, one template, works |
| Week 3 | Marketplace demo page | Static seeded cards, filters, compliance badges, request match toast |
| Week 3 | Clean up README | Accurate setup instructions, all 21 migrations listed |
| Week 4 | End-to-end flow test | Manual walkthrough: onboard company → add workers → create job → trigger compliance block → resolve → ghost event → autofill |
| Week 4 | Add basic seed script | `scripts/seed.js` — populates workers, companies, jobs for demo |
| Week 4 | Environment hardening | `.env.example` current, no hardcoded secrets, basic `npm test` scaffold in place |

---

### Definition of Done — Core MVP

Core MVP is done when ALL of the following are true. No partial credit.

**Data integrity:**
- [ ] All 21 migrations apply cleanly to a fresh database with no errors
- [ ] No foreign key violations possible through normal API use

**Authentication:**
- [ ] Every API route (except `/api/health` and `/api/auth/login`) requires a valid JWT
- [ ] Invalid token returns 401, not a 500 or empty response
- [ ] No header mocks (`x-user-id`, `x-user-role`) in any production code path

**Company governance:**
- [ ] A company can be created with PENDING status
- [ ] A superintendent or admin can activate a company (ACTIVE)
- [ ] A superintendent or admin can suspend a company (SUSPENDED)
- [ ] Every state change is recorded in `company_compliance_history`

**Worker compliance:**
- [ ] A worker can enter credentials with expiry dates
- [ ] An expired credential blocks check-in with a user-readable reason
- [ ] A worker from a SUSPENDED company cannot accept an assignment — blocked at API level
- [ ] A worker from a SUSPENDED company cannot submit a check-in log — blocked at API level

**Ghost detection:**
- [ ] ghostWatcher runs on a schedule and detects assignments past the silence window
- [ ] A detected ghost event triggers emergency autofill automatically
- [ ] The superintendent sees the ghost event in the triage dashboard within the next poll cycle

**Triage dashboard:**
- [ ] LOCKED_JOBS shows all jobs with recent audit_block_log entries
- [ ] COMPLIANCE_ALERTS shows non-ACTIVE companies and workers with expired credentials
- [ ] GHOST_EVENTS shows ghosted assignments and pending ghost escalations
- [ ] Superintendent can resolve an escalation from the UI
- [ ] Audit log table shows block history per entity

**Notifications:**
- [ ] At least one trigger (company suspended OR ghost detected) sends a real email to the superintendent
- [ ] Email is not mock — it actually delivers

**Stability:**
- [ ] Backend starts without errors against a fresh database
- [ ] No undefined controller references in any mounted route
- [ ] Frontend builds without warnings via `npm run build`

---

### A Note on Scope Control

The repo already contains more surface area than the Core MVP requires. That is fine — the scaffolding is useful. But the following principle must hold for the next 30 days:

**No new modules. No new tables. No new concepts.**

If something is not on the 7-day or 30-day list above, it does not get built. If a stakeholder requests a new feature, it goes to the backlog and gets classified against the roadmap phases above before any code is written.

The governance loop — company state, worker credentials, assignment enforcement, ghost recovery, triage dashboard — is the product right now. Everything else is future.

---

*Document generated: 2026-05-04*
*Source of truth: OMNASYN-Systems-LLC/OMNAS-Core @ 7c15075*
*Prepared for: Roddy (Engineering Lead)*
