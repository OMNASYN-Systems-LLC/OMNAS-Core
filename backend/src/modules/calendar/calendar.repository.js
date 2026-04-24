import { db } from "../../config/db.js";

export async function createCalendarEvent(data) {
  const query = `
    INSERT INTO calendar_events (
      job_id, assignment_id, worker_user_id, type, title, start_time, end_time, status, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    data.jobId ?? null,
    data.assignmentId ?? null,
    data.workerUserId ?? null,
    data.type,
    data.title,
    data.startTime,
    data.endTime,
    data.status
  ]);

  return rows[0] ?? null;
}

export async function listCalendarEventsByJobId(jobId) {
  const query = `
    SELECT *
    FROM calendar_events
    WHERE ($1::BIGINT IS NULL OR job_id = $1)
    ORDER BY start_time ASC, created_at ASC
  `;

  const { rows } = await db.query(query, [jobId ?? null]);
  return rows;
}

export async function getAssignmentScheduleContext(assignmentId) {
  const query = `
    SELECT a.id AS assignment_id,
           a.job_id,
           a.worker_user_id,
           a.started_at,
           j.starts_at,
           j.ends_at
    FROM assignments a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.id = $1
  `;

  const { rows } = await db.query(query, [assignmentId]);
  return rows[0] ?? null;
}
