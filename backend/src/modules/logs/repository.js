import { db } from "../../config/db.js";

// 🔥 ENRICHED ASSIGNMENT LOOKUP (w/ job details - codex)
export async function getAssignmentForLog(assignmentId) {
  const query = `
    SELECT 
      a.*, 
      j.id AS job_id, 
      j.title AS job_title,
      j.site_zip,
      j.pay_rate,
      wp.first_name, 
      wp.last_name,
      wp.trade_primary
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.id = $1
  `;
  const { rows } = await db.query(query, [assignmentId]);
  return rows[0] ?? null;
}

// 🔥 DUPLICATE PREVENTION
export async function getLogByAssignmentAndDate(assignmentId, logDate) {
  const { rows } = await db.query(
    "SELECT * FROM daily_logs WHERE assignment_id = $1 AND log_date = $2", 
    [assignmentId, logDate]
  );
  return rows[0] ?? null;
}

// 🔥 FULL CONSTRUCTION LOGGING SCHEMA (merged both branches)
export async function createDailyLog(payload) {
  const query = `
    INSERT INTO daily_logs (
      -- Core fields
      assignment_id, job_id, worker_user_id, assigned_category,
      log_date, hours_worked, crew_size,
      -- Content
      work_summary, work_completed, issues, issues_blockers,
      -- Field data
      weather, photos, location,
      -- AI features (voice + OMNAS)
      auto_summary, voice_transcript, detected_categories,
      confidence, estimated_hours, suggested_summary,
      -- Audit
      submitted_at, submitted_by, is_draft
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13::jsonb, $14::jsonb,
      $15, $16, $17::jsonb,
      $18, $19, $20,
      NOW(), $21, $22
    )
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    // Core
    payload.assignmentId,
    payload.jobId,
    payload.workerUserId,
    payload.assignedCategory,
    // Dates + hours
    payload.logDate,
    Number(payload.hoursWorked),
    payload.crewSize ? Number(payload.crewSize) : null,
    // Content
    payload.workSummary,
    payload.workCompleted ?? payload.workSummary,
    payload.issues ?? null,
    payload.issuesBlockers ?? payload.issues ?? null,
    // Field data
    payload.weather ?? "manual_pending",
    JSON.stringify(normalizePhotos(payload.photos)),
    payload.location ? JSON.stringify(payload.location) : null,
    // AI Voice + OMNAS
    payload.autoSummary ?? null,
    payload.voiceTranscript ?? null,
    JSON.stringify(payload.detectedCategories || []),
    payload.confidence ?? null,
    payload.estimatedHours ?? null,
    payload.suggestedSummary ?? null,
    // Audit
    payload.submittedBy,
    payload.isDraft ?? false
  ]);

  return rows[0];
}

// 🔥 NORMALIZATION HELPERS
function normalizePhotos(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  return [];
}

// 🔥 RECENT FIRST (submitted_at - codex preference)
export async function listLogsForAssignment(assignmentId) {
  const { rows } = await db.query(
    `SELECT 
       dl.*, 
       wp.first_name, wp.last_name
     FROM daily_logs dl
     LEFT JOIN worker_profiles wp ON wp.user_id = dl.worker_user_id
     WHERE dl.assignment_id = $1 
     ORDER BY dl.submitted_at DESC NULLS LAST
     LIMIT 100`,
    [assignmentId]
  );
  return rows;
}

// 🔥 JOIN WITH FALLBACK (LEFT JOIN safety - codex)
export async function getLogById(id) {
  const query = `
    SELECT 
      dl.*, 
      COALESCE(a.worker_user_id, dl.worker_user_id) AS assignment_worker_user_id,
      a.assigned_by,
      j.title AS job_title
    FROM daily_logs dl
    LEFT JOIN assignments a ON a.id = dl.assignment_id
    LEFT JOIN jobs j ON j.id = dl.job_id
    WHERE dl.id = $1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}