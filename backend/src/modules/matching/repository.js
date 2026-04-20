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

export async function replaceMatchScores(jobId, matches) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM match_scores WHERE job_id = $1", [jobId]);

    const insertQuery = `
      INSERT INTO match_scores (job_id, worker_user_id, score, score_breakdown)
      VALUES ($1, $2, $3, $4::jsonb)
    `;

    for (const match of matches) {
      await client.query(insertQuery, [jobId, match.worker_user_id, match.total_score, JSON.stringify(match.score_breakdown)]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
