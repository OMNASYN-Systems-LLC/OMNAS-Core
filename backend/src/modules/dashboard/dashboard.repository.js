import { db } from "../../config/db.js";

export async function getDashboardJobActivity(jobId, contractorUserId) {
  const jobQuery = `
    SELECT id, title, posted_by
    FROM jobs
    WHERE id = $1 AND posted_by = $2
  `;

  const logsQuery = `
    SELECT COUNT(*)::INT AS total_logs,
           COUNT(*) FILTER (WHERE log_date = CURRENT_DATE)::INT AS today_logs,
           MAX(submitted_at) AS last_log_at
    FROM daily_logs
    WHERE job_id = $1
  `;

  const { rows: jobRows } = await db.query(jobQuery, [jobId, contractorUserId]);
  if (!jobRows[0]) return null;

  const { rows: logRows } = await db.query(logsQuery, [jobId]);
  return {
    job: jobRows[0],
    logs: logRows[0] || { total_logs: 0, today_logs: 0, last_log_at: null }
  };
}
