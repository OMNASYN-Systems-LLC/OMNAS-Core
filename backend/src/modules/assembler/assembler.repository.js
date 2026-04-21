import { db } from "../../config/db.js";

// Slot status: how many slots are required, filled, pending (offered), and open.
export async function getJobSlotStatus(jobId, contractorUserId) {
  const { rows } = await db.query(
    `SELECT
       j.id,
       j.posted_by,
       j.status AS job_status,
       (SELECT COUNT(*)::INT FROM job_required_skills WHERE job_id = j.id)           AS required_slots,
       (SELECT COUNT(*)::INT FROM assignments
        WHERE job_id = j.id AND status IN ('accepted', 'active', 'completed'))       AS filled_count,
       (SELECT COUNT(*)::INT FROM assignments
        WHERE job_id = j.id AND status = 'offered')                                  AS pending_count
     FROM jobs j
     WHERE j.id = $1 AND j.posted_by = $2`,
    [jobId, contractorUserId]
  );

  if (!rows[0]) return null;

  const r = rows[0];
  const requiredSlots = Number(r.required_slots);
  const filledCount   = Number(r.filled_count);
  const pendingCount  = Number(r.pending_count);
  // Don't count pending offers against open slots — they may still be declined
  const openSlots     = Math.max(0, requiredSlots - filledCount);

  return {
    jobId:         Number(r.id),
    postedBy:      r.posted_by,
    jobStatus:     r.job_status,
    requiredSlots,
    filledCount,
    pendingCount,
    openSlots,
  };
}

// All worker IDs that have a live (non-declined, non-cancelled) assignment on this job.
export async function getActiveWorkerIdsForJob(jobId) {
  const { rows } = await db.query(
    `SELECT worker_user_id
     FROM assignments
     WHERE job_id = $1 AND status NOT IN ('declined', 'cancelled')`,
    [jobId]
  );
  return rows.map((r) => r.worker_user_id);
}

// Cancel offered assignments that have been waiting longer than timeoutMinutes.
// Returns the cancelled rows so the caller can report how many timed out.
export async function expireTimedOutOffers(jobId, timeoutMinutes) {
  const { rows } = await db.query(
    `UPDATE assignments
     SET status = 'cancelled', updated_at = NOW()
     WHERE job_id = $1
       AND status = 'offered'
       AND offered_at < NOW() - ($2 || ' minutes')::INTERVAL
     RETURNING id, worker_user_id`,
    [jobId, String(timeoutMinutes)]
  );
  return rows;
}
