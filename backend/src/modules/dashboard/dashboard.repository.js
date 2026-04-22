import { db } from "../../config/db.js";

export async function getDashboardJob(jobId) {
  const { rows } = await db.query(
    `SELECT
       j.id, j.posted_by, j.title, j.status,
       j.starts_at, j.ends_at, j.pay_rate, j.metadata,
       (SELECT COUNT(*)::INT FROM job_required_skills WHERE job_id = j.id) AS required_slots
     FROM jobs j
     WHERE j.id = $1`,
    [jobId]
  );
  return rows[0] ?? null;
}

export async function getDashboardAssignments(jobId) {
  const { rows } = await db.query(
    `SELECT
       a.id, a.worker_user_id, a.status,
       a.offered_at, a.responded_at, a.started_at, a.completed_at,
       (SELECT COUNT(*)::INT FROM daily_logs dl WHERE dl.assignment_id = a.id) AS log_count
     FROM assignments a
     WHERE a.job_id = $1
     ORDER BY a.created_at ASC`,
    [jobId]
  );
  return rows;
}

export async function getDashboardLogs(jobId) {
  const { rows } = await db.query(
    `SELECT
       dl.id, dl.assignment_id, dl.log_date, dl.hours_worked,
       dl.work_summary, dl.issues, dl.issues_blockers,
       dl.submitted_at
     FROM daily_logs dl
     JOIN assignments a ON a.id = dl.assignment_id
     WHERE a.job_id = $1
     ORDER BY dl.log_date DESC, dl.submitted_at DESC
     LIMIT 200`,
    [jobId]
  );
  return rows;
}

export async function getDashboardMatchStats(jobId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*)::INT                                        AS total_matches,
       COALESCE(AVG(score), 0)::NUMERIC(10,2)              AS avg_score,
       COALESCE(MAX(score), 0)::NUMERIC(10,2)              AS top_score,
       COUNT(*) FILTER (WHERE score >= 85)::INT            AS high_quality_matches
     FROM match_scores
     WHERE job_id = $1`,
    [jobId]
  );
  return rows[0] ?? { total_matches: 0, avg_score: 0, top_score: 0, high_quality_matches: 0 };
}
