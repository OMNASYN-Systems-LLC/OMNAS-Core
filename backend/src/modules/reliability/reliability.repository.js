import { db } from "../../config/db.js";

// All signals needed to compute a reliability score in one parallel fetch.
export async function getReliabilitySignals(workerUserId) {
  const [assignmentRes, logRes, anomalyRes] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::INT                                                           AS total_assignments,
         COUNT(*) FILTER (WHERE status = 'completed')::INT                      AS completed_count,
         COUNT(*) FILTER (WHERE status = 'cancelled')::INT                      AS cancelled_count,
         COUNT(*) FILTER (WHERE status = 'declined')::INT                       AS declined_count,
         COUNT(*) FILTER (
           WHERE status IN ('accepted','declined','active','completed','cancelled')
         )::INT                                                                  AS responded_count
       FROM assignments
       WHERE worker_user_id = $1`,
      [workerUserId]
    ),

    db.query(
      `SELECT
         COUNT(*)::INT                                                           AS total_logs,
         COALESCE(AVG(hours_worked),  0)::NUMERIC(5,2)                         AS avg_hours,
         COALESCE(STDDEV_POP(hours_worked), 0)::NUMERIC(5,2)                   AS hours_stddev,
         COUNT(*) FILTER (WHERE hours_worked > 16)::INT                         AS extreme_hours_count,
         COUNT(*) FILTER (
           WHERE submitted_at > (log_date::TIMESTAMPTZ + INTERVAL '2 days')
         )::INT                                                                  AS late_submissions
       FROM daily_logs
       WHERE worker_user_id = $1
         AND is_draft = FALSE`,
      [workerUserId]
    ),

    db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE issues        ILIKE ANY(ARRAY['%unsafe%','%injury%','%hazard%','%violation%','%blocker%','%delay%'])
              OR issues_blockers ILIKE ANY(ARRAY['%unsafe%','%injury%','%hazard%','%violation%','%blocker%','%delay%'])
         )::INT AS flagged_logs
       FROM daily_logs
       WHERE worker_user_id = $1
         AND is_draft = FALSE`,
      [workerUserId]
    ),
  ]);

  return {
    assignments: assignmentRes.rows[0],
    logs:        logRes.rows[0],
    anomalies:   anomalyRes.rows[0],
  };
}

export async function persistReliabilityScore(workerUserId, score) {
  const { rows } = await db.query(
    `UPDATE worker_profiles
     SET reliability_score = $2, updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id, reliability_score, updated_at`,
    [workerUserId, score]
  );
  return rows[0] ?? null;
}

export async function getWorkerReliabilityRow(workerUserId) {
  const { rows } = await db.query(
    `SELECT user_id, first_name, last_name, trade_primary, reliability_score, updated_at
     FROM worker_profiles
     WHERE user_id = $1`,
    [workerUserId]
  );
  return rows[0] ?? null;
}
