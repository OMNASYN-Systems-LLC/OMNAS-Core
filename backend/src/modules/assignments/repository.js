import { db } from "../../config/db.js";

export async function createAssignment(payload) {
  const query = `
    INSERT INTO assignments (job_id, worker_user_id, assigned_by, status, offered_at, updated_at)
    VALUES ($1, $2, $3, 'offered', NOW(), NOW())
    RETURNING *
  `;

  const { rows } = await db.query(query, [payload.jobId, payload.workerUserId, payload.assignedBy]);
  return rows[0];
}

export async function getAssignmentById(id) {
  const query = `
    SELECT a.*, j.title AS job_title, wp.first_name, wp.last_name
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.id = $1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}

export async function getAssignmentByJobAndWorker(jobId, workerUserId) {
  const { rows } = await db.query("SELECT * FROM assignments WHERE job_id = $1 AND worker_user_id = $2", [jobId, workerUserId]);
  return rows[0] ?? null;
}

export async function listAssignmentsForWorker(workerUserId) {
  const query = `
    SELECT a.*, j.title AS job_title, j.description, j.starts_at, j.ends_at
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.worker_user_id = $1
    ORDER BY a.created_at DESC
  `;

  const { rows } = await db.query(query, [workerUserId]);
  return rows;
}

export async function listAssignmentsForContractor(contractorUserId) {
  const query = `
    SELECT a.*, j.title AS job_title
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.assigned_by = $1
    ORDER BY a.created_at DESC
  `;

  const { rows } = await db.query(query, [contractorUserId]);
  return rows;
}

export async function updateAssignmentStatus(id, status, timestamps = {}) {
  const query = `
    UPDATE assignments
    SET status = $2,
        responded_at = COALESCE($3, responded_at),
        started_at = COALESCE($4, started_at),
        completed_at = COALESCE($5, completed_at),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    id,
    status,
    timestamps.respondedAt ?? null,
    timestamps.startedAt ?? null,
    timestamps.completedAt ?? null
  ]);

  return rows[0] ?? null;
}
