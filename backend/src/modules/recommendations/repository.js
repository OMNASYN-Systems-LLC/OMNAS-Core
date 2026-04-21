import { db } from "../../config/db.js";

export async function getJobForRecommendations(jobId, contractorUserId) {
  const query = `
    SELECT j.id, j.title, j.site_zip, j.starts_at, j.ends_at, j.metadata
    FROM jobs j
    WHERE j.id = $1 AND j.posted_by = $2
  `;
  const { rows } = await db.query(query, [jobId, contractorUserId]);
  return rows[0] ?? null;
}

export async function listAssignedWorkerIds(jobId) {
  const query = `
    SELECT DISTINCT a.worker_user_id
    FROM assignments a
    WHERE a.job_id = $1
      AND a.status IN ('accepted', 'active', 'completed', 'offered')
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows.map((row) => row.worker_user_id);
}

export async function listWorkersForRecommendations(excludedWorkerIds) {
  const params = [];
  let exclusionClause = "";

  if (excludedWorkerIds.length > 0) {
    params.push(excludedWorkerIds);
    exclusionClause = "WHERE wp.user_id <> ALL($1::uuid[])";
  }

  const workersQuery = `
    SELECT wp.user_id, wp.first_name, wp.last_name, wp.home_zip,
           wp.trade_primary, wp.years_experience
    FROM worker_profiles wp
    ${exclusionClause}
  `;

  const workersResponse = await db.query(workersQuery, params);
  const workerIds = workersResponse.rows.map((row) => row.user_id);

  if (workerIds.length === 0) {
    return { workers: [], workerSkills: [], availability: [], performance: [] };
  }

  const skillsQuery = `
    SELECT ws.worker_user_id, s.label, s.code, s.category,
           ws.proficiency, ws.years, ws.verified
    FROM worker_skills ws
    JOIN skills s ON s.id = ws.skill_id
    WHERE ws.worker_user_id = ANY($1::uuid[])
  `;

  const availabilityQuery = `
    SELECT wa.worker_user_id, wa.available_start, wa.available_end
    FROM worker_availability wa
    WHERE wa.worker_user_id = ANY($1::uuid[])
  `;

  const performanceQuery = `
    SELECT a.worker_user_id,
           COUNT(*)::INT AS total_assignments,
           COUNT(*) FILTER (WHERE a.status = 'completed')::INT AS total_jobs_completed,
           COALESCE(SUM(dl.hours_worked), 0)::FLOAT AS total_hours_logged,
           COALESCE(AVG(dl.hours_worked), 0)::FLOAT AS avg_hours_per_day,
           COUNT(dl.id)::INT AS logs_count
    FROM assignments a
    LEFT JOIN daily_logs dl ON dl.assignment_id = a.id
    WHERE a.worker_user_id = ANY($1::uuid[])
    GROUP BY a.worker_user_id
  `;

  const [skillsResponse, availabilityResponse, performanceResponse] = await Promise.all([
    db.query(skillsQuery, [workerIds]),
    db.query(availabilityQuery, [workerIds]),
    db.query(performanceQuery, [workerIds])
  ]);

  return {
    workers: workersResponse.rows,
    workerSkills: skillsResponse.rows,
    availability: availabilityResponse.rows,
    performance: performanceResponse.rows
  };
}
