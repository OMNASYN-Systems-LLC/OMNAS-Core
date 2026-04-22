import { db } from "../../config/db.js";

// Create a company and auto-seed a PENDING compliance state — single transaction.
// Pilot constraint: one company per owner_user_id is enforced at the service layer.
export async function insertCompany({ name, licenseNumber, ownerUserId }) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO contractor_companies (name, license_number, owner_user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, licenseNumber ?? null, ownerUserId]
    );
    const company = rows[0];

    // Seed compliance state as PENDING so the company immediately appears in triage
    // and must be explicitly activated before workers can accept assignments.
    await client.query(
      `INSERT INTO company_compliance_states (company_id, status)
       VALUES ($1, 'PENDING')
       ON CONFLICT (company_id) DO NOTHING`,
      [company.id]
    );

    // Append the PENDING entry to history so the audit trail starts at creation time.
    await client.query(
      `INSERT INTO company_compliance_history (company_id, from_status, to_status, reason)
       VALUES ($1, NULL, 'PENDING', 'Company registered — awaiting compliance activation')`,
      [company.id]
    );

    await client.query("COMMIT");
    return company;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findCompanyById(id) {
  const { rows } = await db.query(
    `SELECT cc.*,
            ccs.status        AS compliance_status,
            ccs.reason,
            ccs.reason_code,
            ccs.effective_at,
            COUNT(wa.id) FILTER (WHERE wa.status = 'active') AS active_worker_count
     FROM contractor_companies cc
     LEFT JOIN company_compliance_states ccs ON ccs.company_id = cc.id
     LEFT JOIN worker_affiliations wa         ON wa.company_id  = cc.id
     WHERE cc.id = $1
     GROUP BY cc.id, ccs.status, ccs.reason, ccs.reason_code, ccs.effective_at`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findCompanyByOwner(ownerUserId) {
  const { rows } = await db.query(
    `SELECT cc.*,
            ccs.status AS compliance_status,
            ccs.reason,
            ccs.effective_at
     FROM contractor_companies cc
     LEFT JOIN company_compliance_states ccs ON ccs.company_id = cc.id
     WHERE cc.owner_user_id = $1
     LIMIT 1`,
    [ownerUserId]
  );
  return rows[0] ?? null;
}

export async function listAllCompanies() {
  const { rows } = await db.query(
    `SELECT cc.id, cc.name, cc.license_number, cc.owner_user_id, cc.created_at,
            ccs.status        AS compliance_status,
            ccs.reason,
            ccs.effective_at,
            COUNT(wa.id) FILTER (WHERE wa.status = 'active') AS active_worker_count
     FROM contractor_companies cc
     LEFT JOIN company_compliance_states ccs ON ccs.company_id = cc.id
     LEFT JOIN worker_affiliations wa         ON wa.company_id  = cc.id
     GROUP BY cc.id, cc.name, cc.license_number, cc.owner_user_id, cc.created_at,
              ccs.status, ccs.reason, ccs.effective_at
     ORDER BY cc.created_at DESC`
  );
  return rows;
}

// Upsert affiliation: re-activates a previously removed or suspended affiliation
// when the same worker is re-added.
export async function upsertWorkerAffiliation({ companyId, workerUserId, role }) {
  const { rows } = await db.query(
    `INSERT INTO worker_affiliations (worker_user_id, company_id, role, status, updated_at)
     VALUES ($1, $2, $3, 'active', NOW())
     ON CONFLICT (worker_user_id, company_id) DO UPDATE
       SET status     = 'active',
           role       = EXCLUDED.role,
           updated_at = NOW()
     RETURNING *`,
    [workerUserId, companyId, role]
  );
  return rows[0];
}

// Soft-remove: sets status = 'removed' and stamps updated_at.
export async function softRemoveAffiliation(companyId, workerUserId) {
  const { rows } = await db.query(
    `UPDATE worker_affiliations
     SET status     = 'removed',
         updated_at = NOW()
     WHERE company_id = $1
       AND worker_user_id = $2
       AND status != 'removed'
     RETURNING *`,
    [companyId, workerUserId]
  );
  return rows[0] ?? null;
}

export async function listCompanyWorkers(companyId) {
  const { rows } = await db.query(
    `SELECT wa.id,
            wa.worker_user_id,
            wa.role,
            wa.status         AS affiliation_status,
            wa.joined_at,
            wa.updated_at,
            wp.first_name,
            wp.last_name,
            wp.trade_primary,
            wp.rating_avg
     FROM worker_affiliations wa
     LEFT JOIN worker_profiles wp ON wp.user_id = wa.worker_user_id
     WHERE wa.company_id = $1
     ORDER BY wa.joined_at DESC`,
    [companyId]
  );
  return rows;
}
