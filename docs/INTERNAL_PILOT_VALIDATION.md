# OMNΛS Controlled Internal Pilot Validation (Minimum Dataset + Scenario Runbook)

## Scope
This runbook is **pilot-prep only**: minimum realistic data + core scenario validation.
No marketplace, billing, AFLO, Clutch, or post-pilot scope.

## 1) Minimum Pilot Dataset (documented, reproducible)

### Target shape
- 1 GC / Prime company
- 2 subcontractor companies
- 1 solo / 1099 worker shell
- 4–8 workers total
- >= 2 jobs + assignments
- mixed credential validity
- company status mix: ACTIVE + PENDING/SUSPENDED

### Reference IDs (example)
- GC company: `c_gc_prime`
- Sub #1 company: `c_sub_electrical`
- Sub #2 company: `c_sub_plumbing`
- Solo company: `c_solo`

- Contractor users: `u_gc_admin`, `u_sub_admin_1`, `u_sub_admin_2`
- Workers: `u_w1`..`u_w6`

### Recommended setup path
Use API first (where available), then DB SQL for the minimum pilot-only statuses and affiliations.

1. Register/login pilot users (frontend or `/api/auth/*`) to establish role sessions.
2. Create/claim companies through `/api/companies/invite` + `/api/companies/claim`.
3. Ensure 4–8 worker profiles exist.
4. Create at least two jobs and offers/assignments from contractor dashboard.
5. Apply pilot-only status shaping in DB:
   - one ACTIVE company
   - one SUSPENDED (or PENDING/INVITED)
   - at least one worker credential-valid and one credential-invalid profile marker

> Note: credential-specific tables vary by environment; if credential documents are not modeled as first-class rows yet, encode validity via escalation reasons/rule triggers for pilot validation.

## 2) Controlled Scenario Execution Matrix

Run these scenarios in order and collect result (PASS/FAIL/BLOCKED).

1. **Contractor/company creation**
   - Invite company shell, claim as contractor owner.
   - Expected: company row present and claim success.

2. **Worker affiliation**
   - Attach workers to GC/sub companies via `worker_affiliations`.
   - Expected: worker role + status ACTIVE where intended.

3. **Credential upload / validity split**
   - Mark one worker as valid, one invalid (document table/flag used in env).

4. **Assignment acceptance ALLOW**
   - Valid worker accepts assignment.
   - Expected: accepted/active transition succeeds.

5. **Assignment acceptance BLOCK**
   - Suspended/pending company path OR invalid credential path.
   - Expected: API rejects and emits machine-readable reason code where available.

6. **Check-in ALLOW**
   - Valid worker submits daily execution log.

7. **Check-in BLOCK**
   - Invalid credential/suspended case.
   - Expected: blocked with explicit reason.

8. **Override path**
   - Resolve escalation via `/api/escalations/:id/decision`.

9. **Ghost detection path**
   - Leave accepted assignment stale; run ghost watcher/dispatcher cycle.
   - Expected: ghost-related escalation or status transition.

10. **Triage dashboard truth**
   - `GET /api/dashboard/triage`
   - Expected buckets returned:
     - `LOCKED_JOBS`
     - `COMPLIANCE_ALERTS`
     - `GHOST_EVENTS`

## 3) UI + Backend Alignment Checks

- Worker dashboard actions should align with assignment/log rows and response outcomes.
- Contractor dashboard should reflect jobs/escalation count impacts.
- Pivot dashboard should show triage buckets + escalation queue actions.
- Role-specific routes should enforce access boundaries.

## 4) Evidence Capture Template

For each scenario capture:
- API request/response (status + payload)
- relevant DB row IDs before/after
- UI screenshot and timestamp
- PASS/FAIL/BLOCKED

## 5) Go / No-Go Rule

- **Ready for internal pilot** when:
  - auth/role routing works end-to-end,
  - triage buckets respond,
  - at least one allow + one block path verified for acceptance/check-in,
  - override and ghost paths validated.

- **Needs one more small fix** when a single integration gap remains (e.g., endpoint path mismatch).
- **Not ready** when multiple core scenarios are blocked.
