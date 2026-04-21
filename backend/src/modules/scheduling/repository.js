import { db } from "../../config/db.js";

export async function getJobSchedulingContext(jobId, contractorUserId) {
  const jobQuery = `
    SELECT j.id, j.title, j.starts_at, j.ends_at, j.site_zip, j.metadata
    FROM jobs j
    WHERE j.id = $1 AND j.posted_by = $2
  `;

  const jobRes = await db.query(jobQuery, [jobId, contractorUserId]);
  const job = jobRes.rows[0] ?? null;

  if (!job) {
    return null;
  }

  const assignmentsQuery = `
    SELECT a.id, a.status, a.worker_user_id,
           wp.first_name, wp.last_name, wp.trade_primary,
           j.title AS job_title
    FROM assignments a
    JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    JOIN jobs j ON j.id = a.job_id
    WHERE a.job_id = $1
      AND a.status IN ('accepted', 'active', 'offered', 'completed')
  `;

  const workerSkillsQuery = `
    SELECT ws.worker_user_id, s.category, s.label, s.code,
           ws.proficiency, ws.years
    FROM worker_skills ws
    JOIN skills s ON s.id = ws.skill_id
  `;

  const logsQuery = `
    SELECT dl.*
    FROM daily_logs dl
    WHERE dl.job_id = $1
       OR dl.assignment_id IN (SELECT id FROM assignments WHERE job_id = $1)
    ORDER BY dl.submitted_at DESC
  `;

  const [assignmentsRes, workerSkillsRes, logsRes] = await Promise.all([
    db.query(assignmentsQuery, [jobId]),
    db.query(workerSkillsQuery),
    db.query(logsQuery, [jobId])
  ]);

  return {
    job,
    assignments: assignmentsRes.rows,
    workerSkills: workerSkillsRes.rows,
    logs: logsRes.rows
  };
}
