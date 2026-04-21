import { db } from "../../config/db.js";

export async function getAssignmentForLog(assignmentId) {
  const query = `
    SELECT a.*, j.id AS job_id, j.title AS job_title
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.id = $1
  `;
  const { rows } = await db.query(query, [assignmentId]);
  return rows[0] ?? null;
}

export async function getLogByAssignmentAndDate(assignmentId, logDate) {
  const { rows } = await db.query("SELECT * FROM daily_logs WHERE assignment_id = $1 AND log_date = $2", [assignmentId, logDate]);
  return rows[0] ?? null;
}

export async function createDailyLog(payload) {
  const query = `
    INSERT INTO daily_logs (
      assignment_id, job_id, worker_user_id, assigned_category,
      log_date, hours_worked, crew_size,
      work_summary, work_completed, issues, issues_blockers,
      weather, photos, location,
      auto_summary, voice_transcript, detected_categories,
      confidence, estimated_hours, suggested_summary,
      submitted_at, submitted_by, is_draft
    ) VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,$10,$11,
      $12,$13::jsonb,$14::jsonb,
      $15,$16,$17::jsonb,
      $18,$19,$20,
      NOW(),$21,$22
    )
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    payload.assignmentId,
    payload.jobId,
    payload.workerUserId,
    payload.assignedCategory,
    payload.logDate,
    payload.hoursWorked,
    payload.crewSize,
    payload.workSummary,
    payload.workCompleted,
    payload.issues,
    payload.issuesBlockers,
    payload.weather,
    JSON.stringify(payload.photos || []),
    payload.location ? JSON.stringify(payload.location) : null,
    payload.autoSummary,
    payload.voiceTranscript,
    JSON.stringify(payload.detectedCategories || []),
    payload.confidence,
    payload.estimatedHours,
    payload.suggestedSummary,
    payload.submittedBy,
    payload.isDraft ?? false
  ]);

  return rows[0];
}

export async function listLogsForAssignment(assignmentId) {
  const { rows } = await db.query("SELECT * FROM daily_logs WHERE assignment_id = $1 ORDER BY submitted_at DESC", [assignmentId]);
  return rows;
}

export async function getLogById(id) {
  const query = `
    SELECT dl.*, a.worker_user_id AS assignment_worker_user_id, a.assigned_by
    FROM daily_logs dl
    LEFT JOIN assignments a ON a.id = dl.assignment_id
    WHERE dl.id = $1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}
