import { db } from "../../config/db.js";

export async function getJobWithRequirements(jobId, contractorUserId) {
  const { rows } = await db.query("SELECT * FROM jobs WHERE id = $1 AND posted_by = $2", [jobId, contractorUserId]);
  const job = rows[0] ?? null;

  if (!job) {
    return null;
  }

  const reqSkillsQuery = `
    SELECT jrs.skill_id, jrs.min_proficiency, jrs.required, s.label, s.code, s.category
    FROM job_required_skills jrs
    JOIN skills s ON s.id = jrs.skill_id
    WHERE jrs.job_id = $1
  `;

  const reqSkills = await db.query(reqSkillsQuery, [jobId]);
  return { ...job, requiredSkills: reqSkills.rows };
}

export async function listWorkersForMatching() {
  const workerQuery = `
    SELECT wp.user_id, wp.first_name, wp.last_name, wp.home_zip, wp.trade_primary
    FROM worker_profiles wp
  `;
  const workersResponse = await db.query(workerQuery);

  const skillsQuery = `
    SELECT ws.worker_user_id, ws.skill_id, ws.proficiency, ws.years, ws.verified,
           s.label, s.code, s.category
    FROM worker_skills ws
    JOIN skills s ON s.id = ws.skill_id
  `;

  const availabilityQuery = `
    SELECT worker_user_id, available_start, available_end
    FROM worker_availability
  `;

  const [skillsResponse, availabilityResponse] = await Promise.all([
    db.query(skillsQuery),
    db.query(availabilityQuery)
  ]);

  return {
    workers: workersResponse.rows,
    workerSkills: skillsResponse.rows,
    workerAvailability: availabilityResponse.rows
  };
}

export async function listWorkerPerformance() {
  const assignmentsQuery = `
    SELECT worker_user_id,
           COUNT(*)::INT AS total_assignments,
           COUNT(*) FILTER (WHERE status = 'completed')::INT AS total_jobs_completed
    FROM assignments
    GROUP BY worker_user_id
  `;

  const hoursQuery = `
    SELECT a.worker_user_id,
           COALESCE(SUM(dl.hours_worked), 0)::FLOAT AS total_hours_logged,
           COALESCE(AVG(dl.hours_worked), 0)::FLOAT AS avg_hours_per_day,
           COALESCE(STDDEV_POP(dl.hours_worked), 0)::FLOAT AS hours_stddev,
           COUNT(dl.id)::INT AS logs_count
    FROM assignments a
    LEFT JOIN daily_logs dl ON dl.assignment_id = a.id
    GROUP BY a.worker_user_id
  `;

  const [assignmentsRes, hoursRes] = await Promise.all([db.query(assignmentsQuery), db.query(hoursQuery)]);

  return {
    assignments: assignmentsRes.rows,
    hours: hoursRes.rows
  };
}

export async function getRankedMatchScoresFromCache(jobId) {
  const { rows } = await db.query(
    `SELECT
       ms.worker_user_id,
       ms.score         AS total_score,
       ms.performance_score,
       ms.score_breakdown,
       wp.first_name,
       wp.last_name,
       wp.trade_primary
     FROM match_scores ms
     JOIN worker_profiles wp ON wp.user_id = ms.worker_user_id
     WHERE ms.job_id = $1
     ORDER BY ms.score DESC`,
    [jobId]
  );
  return rows;
}

export async function replaceMatchScores(jobId, matches) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM match_scores WHERE job_id = $1", [jobId]);

    const insertQuery = `
      INSERT INTO match_scores (job_id, worker_user_id, score, performance_score, score_breakdown)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `;

    for (const match of matches) {
      await client.query(insertQuery, [
        jobId,
        match.worker_user_id,
        match.total_score,
        match.performance_score,
        JSON.stringify(match.score_breakdown)
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
