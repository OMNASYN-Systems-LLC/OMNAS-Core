import { db } from "../../config/db.js";

// --- Company compliance state ---

export async function getComplianceState(companyId) {
  const { rows } = await db.query(
    "SELECT * FROM company_compliance_states WHERE company_id = $1",
    [companyId]
  );
  return rows[0] ?? null;
}

// Upsert the live compliance state and append one history row — all in one transaction.
export async function upsertComplianceState(companyId, status, opts = {}) {
  const { reason = null, reasonCode = null, changedBy = null } = opts;
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows: cur } = await client.query(
      "SELECT status FROM company_compliance_states WHERE company_id = $1",
      [companyId]
    );
    const fromStatus = cur[0]?.status ?? null;

    const { rows } = await client.query(
      `INSERT INTO company_compliance_states
         (company_id, status, reason, reason_code, changed_by, effective_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (company_id) DO UPDATE
         SET status       = EXCLUDED.status,
             reason       = EXCLUDED.reason,
             reason_code  = EXCLUDED.reason_code,
             changed_by   = EXCLUDED.changed_by,
             effective_at = NOW(),
             updated_at   = NOW()
       RETURNING *`,
      [companyId, status, reason, reasonCode, changedBy]
    );

    await client.query(
      `INSERT INTO company_compliance_history
         (company_id, from_status, to_status, reason, reason_code, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, fromStatus, status, reason, reasonCode, changedBy]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getComplianceHistory(companyId) {
  const { rows } = await db.query(
    `SELECT * FROM company_compliance_history
     WHERE company_id = $1
     ORDER BY changed_at DESC
     LIMIT 50`,
    [companyId]
  );
  return rows;
}

// --- Worker affiliation + company lookup ---

// Returns the worker's active company affiliation joined with current compliance state.
// Returns null when the worker has no active affiliation (solo worker — no block applies).
export async function getWorkerCompanyCompliance(workerUserId) {
  const { rows } = await db.query(
    `SELECT wa.company_id,
            wa.role,
            wa.status         AS affiliation_status,
            cc.name           AS company_name,
            ccs.status        AS compliance_status,
            ccs.reason,
            ccs.reason_code
     FROM worker_affiliations wa
     JOIN contractor_companies cc    ON cc.id  = wa.company_id
     LEFT JOIN company_compliance_states ccs ON ccs.company_id = wa.company_id
     WHERE wa.worker_user_id = $1
       AND wa.status = 'active'
     LIMIT 1`,
    [workerUserId]
  );
  return rows[0] ?? null;
}

export async function getCompanyWorkerIds(companyId) {
  const { rows } = await db.query(
    `SELECT worker_user_id
     FROM worker_affiliations
     WHERE company_id = $1 AND status = 'active'`,
    [companyId]
  );
  return rows.map((r) => r.worker_user_id);
}

// --- Worker credentials ---

export async function getExpiredCredentials(workerUserId) {
  const { rows } = await db.query(
    `SELECT credential_type, credential_id, expires_at
     FROM worker_credentials
     WHERE worker_user_id = $1
       AND expires_at IS NOT NULL
       AND expires_at < CURRENT_DATE
     ORDER BY expires_at DESC`,
    [workerUserId]
  );
  return rows;
}

// --- Audit block log ---

export async function logBlockEvent(payload) {
  const { rows } = await db.query(
    `INSERT INTO audit_block_log
       (block_type, reason_code, reason_detail, entity_type, entity_id,
        worker_user_id, company_id, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [
      payload.blockType,
      payload.reasonCode,
      payload.reasonDetail,
      payload.entityType,
      payload.entityId    ?? null,
      payload.workerUserId ?? null,
      payload.companyId   ?? null,
      JSON.stringify(payload.context ?? {})
    ]
  );
  return rows[0];
}

// --- Company listing ---

export async function getAllCompaniesWithStatus() {
  const { rows } = await db.query(
    `SELECT cc.id, cc.name, cc.owner_user_id, cc.created_at,
            ccs.status        AS compliance_status,
            ccs.reason,
            ccs.reason_code,
            ccs.effective_at
     FROM contractor_companies cc
     LEFT JOIN company_compliance_states ccs ON ccs.company_id = cc.id
     ORDER BY cc.created_at DESC`
  );
  return rows;
}

export async function getCompanyById(companyId) {
  const { rows } = await db.query(
    "SELECT * FROM contractor_companies WHERE id = $1",
    [companyId]
  );
  return rows[0] ?? null;
}
