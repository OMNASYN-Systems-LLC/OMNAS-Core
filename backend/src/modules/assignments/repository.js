import { db } from "../../config/db.js";

// expires_at and urgency_level columns are added by migration 017.
// Callers that don't supply them receive NULL / 'standard' defaults, so
// existing code paths (autofill batch, direct offer creation) are unaffected.
export async function createAssignment(payload) {
  const query = `
    INSERT INTO assignments (
      job_id, worker_user_id, assigned_by, status,
      offered_at, expires_at, urgency_level, updated_at
    )
    VALUES ($1, $2, $3, 'offered', NOW(), $4, $5, NOW())
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    payload.jobId,
    payload.workerUserId,
    payload.assignedBy,
    payload.expiresAt    ?? null,
    payload.urgencyLevel ?? "standard"
  ]);
  return rows[0];
}

export async function getAssignmentById(id) {
  const query = `
    SELECT a.*, j.title AS job_title, wp.first_name, wp.last_name
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.id = $1
  `;

  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}

// Only blocks re-offering when a live (offered/accepted/active) assignment exists.
// Declined, cancelled, ghosted, and expired assignments allow re-offers.
export async function getAssignmentByJobAndWorker(jobId, workerUserId) {
  const { rows } = await db.query(
    `SELECT * FROM assignments
     WHERE job_id = $1 AND worker_user_id = $2
       AND status IN ('offered', 'accepted', 'active')
     ORDER BY created_at DESC LIMIT 1`,
    [jobId, workerUserId]
  );
  return rows[0] ?? null;
}

export async function listAssignmentsForWorker(workerUserId) {
  const query = `
    SELECT a.*, j.title AS job_title, j.description, j.starts_at, j.ends_at
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.worker_user_id = $1
    ORDER BY a.created_at DESC
  `;

  const { rows } = await db.query(query, [workerUserId]);
  return rows;
}

export async function listAssignmentsForContractor(contractorUserId) {
  const query = `
    SELECT a.*, j.title AS job_title
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.assigned_by = $1
    ORDER BY a.created_at DESC
  `;

  const { rows } = await db.query(query, [contractorUserId]);
  return rows;
}

// Creates multiple assignment offers in a single transaction.
// Skips any worker who already has a non-declined/non-cancelled assignment on this job.
export async function createAssignmentsBatch(records) {
  const client  = await db.connect();
  const created = [];
  const skipped = [];

  try {
    await client.query("BEGIN");

    for (const r of records) {
      const { rows: existing } = await client.query(
        `SELECT id FROM assignments
         WHERE job_id = $1 AND worker_user_id = $2
           AND status NOT IN ('declined', 'cancelled')
         LIMIT 1`,
        [r.jobId, r.workerUserId]
      );

      if (existing.length > 0) {
        skipped.push({ workerUserId: r.workerUserId, reason: "duplicate" });
        continue;
      }

      const { rows } = await client.query(
        `INSERT INTO assignments (job_id, worker_user_id, assigned_by, status, offered_at, updated_at)
         VALUES ($1, $2, $3, 'offered', NOW(), NOW())
         RETURNING *`,
        [r.jobId, r.workerUserId, r.assignedBy]
      );

      created.push(rows[0]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { created, skipped };
}

export async function updateAssignmentStatus(id, status, timestamps = {}) {
  const query = `
    UPDATE assignments
    SET status       = $2,
        responded_at = COALESCE($3, responded_at),
        started_at   = COALESCE($4, started_at),
        completed_at = COALESCE($5, completed_at),
        updated_at   = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    id,
    status,
    timestamps.respondedAt ?? null,
    timestamps.startedAt   ?? null,
    timestamps.completedAt ?? null
  ]);

  return rows[0] ?? null;
}

// Transactional accept with FOR UPDATE row lock and expiry check.
// Preferred over the two-step fetch+update pattern for concurrency safety.
export async function acceptOfferedAssignmentTransaction(id, workerUserId) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows: lockRows } = await client.query(
      "SELECT * FROM assignments WHERE id = $1 FOR UPDATE",
      [id]
    );
    const assignment = lockRows[0] ?? null;

    if (!assignment) {
      const error = new Error("Assignment not found");
      error.statusCode = 404;
      throw error;
    }

    if (assignment.worker_user_id !== workerUserId) {
      const error = new Error("You can only accept your own assignments");
      error.statusCode = 403;
      throw error;
    }

    if (assignment.status !== "offered") {
      const error = new Error(`Invalid status transition from ${assignment.status}`);
      error.statusCode = 409;
      throw error;
    }

    if (assignment.expires_at && new Date(assignment.expires_at) <= new Date()) {
      const error = new Error("Offer has expired");
      error.statusCode = 409;
      throw error;
    }

    const { rows: updated } = await client.query(
      `UPDATE assignments
       SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    return updated[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// --- Dispatch worker / ghost watcher support ---

export async function listExpiredOffers() {
  const { rows } = await db.query(
    `SELECT id, job_id, assigned_by
     FROM assignments
     WHERE status = 'offered'
       AND expires_at IS NOT NULL
       AND expires_at < NOW()`
  );
  return rows;
}

export async function markAssignmentExpired(id) {
  const { rows } = await db.query(
    "UPDATE assignments SET status = 'expired', updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  return rows[0] ?? null;
}

// Returns accepted assignments that are overdue and have no check-in log.
// Used by ghostWatcher.js (the single canonical ghost-detection path).
export async function findAcceptedAndLate(thresholdMinutes = 15) {
  const minutes = Math.max(1, Number(thresholdMinutes || 15));
  const query   = `
    SELECT a.id,
           a.job_id,
           a.worker_user_id,
           a.assigned_by,
           j.starts_at,
           EXTRACT(EPOCH FROM (NOW() - j.starts_at)) / 60 AS minutes_late
    FROM assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.status = 'accepted'
      AND j.starts_at <= NOW() - ($1::TEXT || ' minutes')::INTERVAL
      AND NOT EXISTS (
        SELECT 1
        FROM daily_logs dl
        WHERE dl.assignment_id = a.id
          AND COALESCE(dl.is_draft, FALSE) = FALSE
          AND (
            LOWER(COALESCE(dl.work_summary,   '')) LIKE '%check_in%'
            OR LOWER(COALESCE(dl.work_summary,   '')) LIKE '%shift_start%'
            OR LOWER(COALESCE(dl.work_completed, '')) LIKE '%check_in%'
            OR LOWER(COALESCE(dl.work_completed, '')) LIKE '%shift_start%'
          )
      )
  `;
  const { rows } = await db.query(query, [String(minutes)]);
  return rows;
}

// Only transitions accepted → ghosted; safe to call multiple times (idempotent).
export async function markAssignmentGhosted(id) {
  const { rows } = await db.query(
    `UPDATE assignments
     SET status = 'ghosted', updated_at = NOW()
     WHERE id = $1 AND status = 'accepted'
     RETURNING *`,
    [id]
  );
  return rows[0] ?? null;
}

// --- Orchestrator retry tracking ---

export async function incrementRetryCountByJob(jobId) {
  const { rows } = await db.query(
    `UPDATE assignments
     SET retry_count = retry_count + 1,
         updated_at  = NOW()
     WHERE id = (
       SELECT id FROM assignments WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1
     )
     RETURNING retry_count`,
    [jobId]
  );
  return Number(rows[0]?.retry_count || 1);
}

export async function getCurrentRetryCount(jobId) {
  const { rows } = await db.query(
    "SELECT COALESCE(MAX(retry_count), 0) AS retry_count FROM assignments WHERE job_id = $1",
    [jobId]
  );
  return Number(rows[0]?.retry_count || 0);
}

// --- Orchestrator slot counting ---

// Counts open slots using metadata.requiredHeadcount (set by the opportunity
// import flow). Falls back to 1 if not present.
export async function countOpenSlots(jobId, contractorUserId) {
  const query = `
    SELECT j.id,
           COALESCE((j.metadata->>'requiredHeadcount')::INT, 1) AS required_headcount,
           (
             SELECT COUNT(*)::INT
             FROM assignments a
             WHERE a.job_id = j.id
               AND a.status IN ('offered', 'accepted', 'active', 'completed')
           ) AS occupied
    FROM jobs j
    WHERE j.id = $1 AND j.posted_by = $2
  `;
  const { rows } = await db.query(query, [jobId, contractorUserId]);
  const row = rows[0];
  if (!row) return 0;
  return Math.max(0, Number(row.required_headcount || 1) - Number(row.occupied || 0));
}

// Live worker IDs currently holding an active position on a job.
export async function getLiveWorkerIdsForJob(jobId) {
  const { rows } = await db.query(
    `SELECT worker_user_id
     FROM assignments
     WHERE job_id = $1 AND status IN ('offered', 'accepted', 'active')`,
    [jobId]
  );
  return rows.map((r) => r.worker_user_id);
}
