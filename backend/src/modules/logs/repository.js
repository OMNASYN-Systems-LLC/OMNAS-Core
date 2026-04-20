import { db } from "../../config/db.js";

export async function getAssignmentForLog(assignmentId) {
  const { rows } = await db.query("SELECT * FROM assignments WHERE id = $1", [assignmentId]);
  return rows[0] ?? null;
}

export async function getLogByAssignmentAndDate(assignmentId, logDate) {
  const { rows } = await db.query("SELECT * FROM daily_logs WHERE assignment_id = $1 AND log_date = $2", [assignmentId, logDate]);
  return rows[0] ?? null;
}

export async function createDailyLog(payload) {
  const query = `
    INSERT INTO daily_logs (
      assignment_id, log_date, hours_worked,
      work_summary, issues, submitted_at, submitted_by
    ) VALUES ($1,$2,$3,$4,$5,NOW(),$6)
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    payload.assignmentId,
    payload.logDate,
    payload.hoursWorked,
    payload.workSummary,
    payload.issues,
    payload.submittedBy
  ]);

  return rows[0];
}

export async function listLogsForAssignment(assignmentId) {
  const { rows } = await db.query("SELECT * FROM daily_logs WHERE assignment_id = $1 ORDER BY log_date DESC", [assignmentId]);
  return rows;
}

export async function getLogById(id) {
  const query = `
    SELECT dl.*, a.worker_user_id, a.assigned_by
    FROM daily_logs dl
    JOIN assignments a ON a.id = dl.assignment_id
    WHERE dl.id = $1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}
