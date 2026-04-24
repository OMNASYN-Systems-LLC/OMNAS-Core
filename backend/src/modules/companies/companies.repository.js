import crypto from "crypto";
import { db } from "../../config/db.js";

export async function createCompanyInvite({ legalName, dbaName, taxId, invitedBy }) {
  const inviteToken = crypto.randomBytes(24).toString("hex");

  const query = `
    INSERT INTO contractor_companies (
      legal_name,
      dba_name,
      tax_id,
      status,
      invite_token,
      invited_by,
      updated_at
    )
    VALUES ($1, $2, $3, 'INVITED', $4, $5, NOW())
    RETURNING *
  `;

  const { rows } = await db.query(query, [legalName ?? null, dbaName ?? null, taxId ?? null, inviteToken, invitedBy ?? null]);
  return rows[0];
}

export async function getCompanyByInviteToken(inviteToken) {
  const { rows } = await db.query("SELECT * FROM contractor_companies WHERE invite_token = $1", [inviteToken]);
  return rows[0] ?? null;
}

export async function claimCompanyByInviteToken(inviteToken, userId) {
  const query = `
    UPDATE contractor_companies
    SET
      status = 'ACTIVE',
      claimed_by = $2,
      invite_token = NULL,
      updated_at = NOW()
    WHERE invite_token = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [inviteToken, userId]);
  return rows[0] ?? null;
}

export async function getCompanyById(companyId) {
  const { rows } = await db.query("SELECT * FROM contractor_companies WHERE id = $1", [companyId]);
  return rows[0] ?? null;
}

export async function listCompanies({ status, limit = 50, offset = 0 } = {}) {
  const values = [];
  const conditions = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  values.push(limit);
  const limitRef = `$${values.length}`;
  values.push(offset);
  const offsetRef = `$${values.length}`;

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT *
    FROM contractor_companies
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limitRef} OFFSET ${offsetRef}
  `;

  const { rows } = await db.query(query, values);
  return rows;
}

export async function upsertWorkerAffiliation({ userId, companyId, role = "OWNER", status = "ACTIVE" }) {
  const query = `
    INSERT INTO worker_affiliations (worker_user_id, company_id, role, status, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (worker_user_id, company_id) DO UPDATE SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(query, [userId, companyId, role, status]);
  return rows[0];
}

export async function findPrimaryAffiliationByWorker(userId) {
  const query = `
    SELECT wa.*, c.legal_name, c.dba_name, c.status AS company_status
    FROM worker_affiliations wa
    JOIN contractor_companies c ON c.id = wa.company_id
    WHERE wa.worker_user_id = $1 AND wa.status = 'ACTIVE'
    ORDER BY CASE wa.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, wa.created_at ASC
    LIMIT 1
  `;

  const { rows } = await db.query(query, [userId]);
  return rows[0] ?? null;
}

export async function createDefaultSoloCompanyShell({ userId }) {
  const defaultName = `Solo ${userId.slice(0, 8)}`;

  const query = `
    INSERT INTO contractor_companies (
      legal_name,
      dba_name,
      status,
      claimed_by,
      invited_by,
      updated_at
    )
    VALUES ($1, $2, 'ACTIVE', $3, $3, NOW())
    RETURNING *
  `;

  const { rows } = await db.query(query, [defaultName, defaultName, userId]);
  return rows[0];
}
