import { db } from "../../config/db.js";

const SELECT_COLS = `
  id, job_id, action_id, message, target_role, status,
  created_by, sent_at, responded_at, created_at, updated_at
`;

export async function insertDirective({ jobId, actionId, message, targetRole, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO directives (job_id, action_id, message, target_role, status, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING ${SELECT_COLS}`,
    [jobId, actionId, message, targetRole, createdBy]
  );
  return rows[0];
}

export async function markDirectiveSent(id) {
  const { rows } = await db.query(
    `UPDATE directives
     SET status = 'sent', sent_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING ${SELECT_COLS}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function updateDirectiveStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE directives
     SET status      = $2,
         responded_at = CASE WHEN $2 = 'responded' THEN NOW() ELSE responded_at END,
         updated_at  = NOW()
     WHERE id = $1
     RETURNING ${SELECT_COLS}`,
    [id, status]
  );
  return rows[0] ?? null;
}

export async function listDirectivesForJob(jobId) {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLS}
     FROM directives
     WHERE job_id = $1
     ORDER BY created_at DESC`,
    [jobId]
  );
  return rows;
}

export async function findDirectiveById(id) {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLS} FROM directives WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
