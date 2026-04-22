import { db } from "../../config/db.js";

async function replaceRequiredSkills(client, jobId, skills) {
  await client.query("DELETE FROM job_required_skills WHERE job_id = $1", [jobId]);

  const insertQuery = `
    INSERT INTO job_required_skills (job_id, skill_id, min_proficiency, required)
    VALUES ($1, $2, $3, $4)
  `;

  for (const skill of skills) {
    await client.query(insertQuery, [jobId, skill.skillId, skill.minProficiency, skill.required]);
  }
}

export async function createJob(postedBy, payload) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const jobInsertQuery = `
      INSERT INTO jobs (
        organization_id, posted_by, title, description,
        site_zip, starts_at, ends_at, pay_rate, status, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
      RETURNING *
    `;

    const { rows } = await client.query(jobInsertQuery, [
      payload.organizationId,
      postedBy,
      payload.title,
      payload.description,
      payload.siteZip,
      payload.startsAt,
      payload.endsAt,
      payload.payRate,
      payload.status ?? "open"
    ]);

    const job = rows[0];
    await replaceRequiredSkills(client, job.id, payload.requiredSkills);

    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listJobs(postedBy) {
  const query = `
    SELECT j.*, COUNT(jrs.skill_id)::INT AS skill_count
    FROM jobs j
    LEFT JOIN job_required_skills jrs ON jrs.job_id = j.id
    WHERE j.posted_by = $1
    GROUP BY j.id
    ORDER BY j.created_at DESC
  `;

  const { rows } = await db.query(query, [postedBy]);
  return rows;
}

export async function getJobById(id, postedBy) {
  const { rows } = await db.query("SELECT * FROM jobs WHERE id = $1 AND posted_by = $2", [id, postedBy]);
  return rows[0] ?? null;
}

export async function getJobSkills(jobId) {
  const query = `
    SELECT jrs.job_id, jrs.skill_id, jrs.min_proficiency, jrs.required, s.code, s.label, s.category
    FROM job_required_skills jrs
    JOIN skills s ON s.id = jrs.skill_id
    WHERE jrs.job_id = $1
    ORDER BY s.label ASC
  `;

  const { rows } = await db.query(query, [jobId]);
  return rows;
}

export async function updateJob(jobId, postedBy, payload) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const updateQuery = `
      UPDATE jobs SET
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        site_zip = COALESCE($5, site_zip),
        starts_at = COALESCE($6, starts_at),
        ends_at = COALESCE($7, ends_at),
        pay_rate = COALESCE($8, pay_rate),
        status = COALESCE($9, status),
        updated_at = NOW()
      WHERE id = $1 AND posted_by = $2
      RETURNING *
    `;

    const { rows } = await client.query(updateQuery, [
      jobId,
      postedBy,
      payload.title,
      payload.description,
      payload.siteZip,
      payload.startsAt,
      payload.endsAt,
      payload.payRate,
      payload.status
    ]);

    const job = rows[0] ?? null;

    if (job && payload.requiredSkills) {
      await replaceRequiredSkills(client, job.id, payload.requiredSkills);
    }

    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteJob(jobId, postedBy) {
  const { rowCount } = await db.query("DELETE FROM jobs WHERE id = $1 AND posted_by = $2", [jobId, postedBy]);
  return rowCount > 0;
}

// ─── Document gating helpers ─────────────────────────────────────────────────

// Merges document gating state into jobs.metadata.doc_gating without
// disturbing any other keys already present in the metadata document.
export async function patchJobDocGating(jobId, patch) {
  await db.query(
    `UPDATE jobs
     SET metadata   = jsonb_set(
           metadata,
           '{doc_gating}',
           COALESCE(metadata->'doc_gating', '{}'::jsonb) || $2::jsonb
         ),
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, JSON.stringify(patch)]
  );
}

// Reads the current doc_gating advisory block from jobs.metadata.
// Returns null when no gating evaluation has been persisted yet.
export async function getJobDocGating(jobId) {
  const { rows } = await db.query(
    `SELECT metadata->'doc_gating' AS doc_gating FROM jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0]?.doc_gating ?? null;
}

// ─── Ghost recovery helpers ───────────────────────────────────────────────────

// Returns true when the job is already locked into a ghost-replacement cycle.
export async function isJobReplacing(jobId) {
  const { rows } = await db.query(
    `SELECT (metadata->'ghost_recovery'->>'is_replacing')::boolean AS is_replacing
     FROM jobs WHERE id = $1`,
    [jobId]
  );
  return rows[0]?.is_replacing === true;
}

// Atomically sets is_replacing + at_risk inside metadata.ghost_recovery without
// disturbing any other keys already present in the metadata document.
export async function setReplacementLock(jobId) {
  await db.query(
    `UPDATE jobs
     SET metadata   = jsonb_set(
           metadata,
           '{ghost_recovery}',
           COALESCE(metadata->'ghost_recovery', '{}'::jsonb)
             || '{"is_replacing":true,"at_risk":true}'::jsonb
         ),
         updated_at = NOW()
     WHERE id = $1`,
    [jobId]
  );
}

// Merges arbitrary advisory fields into metadata.ghost_recovery.
// Used by the scheduling service to store ghost_event_link and ripple_delay_est.
export async function patchJobGhostRecovery(jobId, patch) {
  await db.query(
    `UPDATE jobs
     SET metadata   = jsonb_set(
           metadata,
           '{ghost_recovery}',
           COALESCE(metadata->'ghost_recovery', '{}'::jsonb) || $2::jsonb
         ),
         updated_at = NOW()
     WHERE id = $1`,
    [jobId, JSON.stringify(patch)]
  );
}
