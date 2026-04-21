import { db } from "../../config/db.js";

export async function getJobForCommand(jobId) {
  const query = `
    SELECT j.id, j.organization_id, j.posted_by, j.title, j.description,
           j.site_zip, j.starts_at, j.ends_at, j.pay_rate, j.status,
           j.created_at, j.updated_at,
           (SELECT COUNT(*) FROM job_required_skills jrs WHERE jrs.job_id = j.id)::INT AS required_slots
    FROM jobs j
    WHERE j.id = $1
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? null;
}

export async function getAssignmentsForJob(jobId) {
  const query = `
    SELECT a.id, a.job_id, a.worker_user_id, a.assigned_by, a.status,
           a.offered_at, a.responded_at, a.started_at, a.completed_at,
           a.created_at, a.updated_at,
           wp.first_name, wp.last_name
    FROM assignments a
    LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.job_id = $1
    ORDER BY a.created_at ASC
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows;
}

export async function getLogsForJob(jobId) {
  const query = `
    SELECT dl.id, dl.assignment_id, dl.log_date, dl.hours_worked,
           dl.work_summary, dl.issues, dl.submitted_at, dl.submitted_by,
           a.worker_user_id
    FROM daily_logs dl
    JOIN assignments a ON a.id = dl.assignment_id
    WHERE a.job_id = $1
    ORDER BY dl.log_date DESC
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows;
}

export async function getMatchCountsForJob(jobId) {
  const query = `
    SELECT COUNT(*)::INT AS total_matches,
           COALESCE(AVG(score), 0)::NUMERIC(10,2) AS avg_score,
           COALESCE(MAX(score), 0)::NUMERIC(10,2) AS top_score
    FROM match_scores
    WHERE job_id = $1
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? { total_matches: 0, avg_score: 0, top_score: 0 };
}
