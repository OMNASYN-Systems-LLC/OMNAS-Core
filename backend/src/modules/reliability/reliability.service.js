import {
  getReliabilitySignals,
  getWorkerReliabilityRow,
  persistReliabilityScore,
} from "./reliability.repository.js";

function clamp(n, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function levelFor(score) {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  if (score >= 0.40) return "low";
  return "unreliable";
}

// Pure computation — no DB writes.
// Returns null when there is no history (unknown ≠ unreliable).
function computeFromSignals(signals) {
  const { assignments, logs, anomalies } = signals;

  const total        = Number(assignments.total_assignments  ?? 0);
  const completed    = Number(assignments.completed_count    ?? 0);
  const responded    = Number(assignments.responded_count    ?? 0);
  const totalLogs    = Number(logs.total_logs               ?? 0);
  const hoursStddev  = Number(logs.hours_stddev             ?? 0);
  const extremeH     = Number(logs.extreme_hours_count      ?? 0);
  const lateSubmits  = Number(logs.late_submissions         ?? 0);
  const flaggedLogs  = Number(anomalies.flagged_logs        ?? 0);

  if (total === 0 && totalLogs === 0) return null;

  // 1. Completion rate — weight 35%
  const completionRate  = total > 0 ? clamp(completed / total) : 0.5;

  // 2. Log consistency — weight 30%
  // Proxy: logs submitted relative to expected (≈5 per assignment)
  const logConsistency  = total > 0 ? clamp(totalLogs / (total * 5)) : 0;

  // 3. Hours consistency — weight 15%
  // Low standard deviation signals predictable, reliable work patterns
  const hoursConsistency = clamp(1 - hoursStddev / 8);

  // 4. Response rate — weight 10%
  // Workers who always respond (accept or decline) are more predictable
  const responseRate    = total > 0 ? clamp(responded / total) : 0.5;

  // 5. Anomaly penalties — up to −0.13 total deduction
  const penaltyExtreme  = Math.min(0.05, extremeH    * 0.015); // extreme hours
  const penaltyLate     = Math.min(0.03, lateSubmits * 0.010); // late log submission
  const penaltyFlagged  = Math.min(0.05, flaggedLogs * 0.020); // issue-keyword logs
  const totalPenalty    = penaltyExtreme + penaltyLate + penaltyFlagged;

  const raw =
    completionRate   * 0.35 +
    logConsistency   * 0.30 +
    hoursConsistency * 0.15 +
    responseRate     * 0.10 +
    0.10             // full anomaly allowance, then deduct
    - totalPenalty;

  return round3(clamp(raw));
}

// Recompute and persist. Called fire-and-forget from assignment/log hooks.
export async function recomputeReliability(workerUserId) {
  const signals = await getReliabilitySignals(workerUserId);
  const score   = computeFromSignals(signals);
  if (score !== null) {
    await persistReliabilityScore(workerUserId, score);
  }
  return score;
}

// Full profile for the GET endpoint.
export async function getReliabilityProfile(workerUserId) {
  const [row, signals] = await Promise.all([
    getWorkerReliabilityRow(workerUserId),
    getReliabilitySignals(workerUserId),
  ]);

  if (!row) {
    const err = new Error("Worker not found");
    err.statusCode = 404;
    throw err;
  }

  const storedScore = row.reliability_score !== null ? Number(row.reliability_score) : null;
  const score       = storedScore ?? computeFromSignals(signals);

  const { assignments, logs, anomalies } = signals;
  const total       = Number(assignments.total_assignments  ?? 0);
  const completed   = Number(assignments.completed_count    ?? 0);
  const responded   = Number(assignments.responded_count    ?? 0);
  const totalLogs   = Number(logs.total_logs               ?? 0);
  const hoursStddev = Number(logs.hours_stddev             ?? 0);
  const extremeH    = Number(logs.extreme_hours_count      ?? 0);
  const lateSubmits = Number(logs.late_submissions         ?? 0);
  const flaggedLogs = Number(anomalies.flagged_logs        ?? 0);

  const penaltyExtreme = Math.min(0.05, extremeH    * 0.015);
  const penaltyLate    = Math.min(0.03, lateSubmits * 0.010);
  const penaltyFlagged = Math.min(0.05, flaggedLogs * 0.020);

  return {
    workerId:        row.user_id,
    workerName:      `${row.first_name} ${row.last_name}`,
    tradePrimary:    row.trade_primary,
    reliabilityScore: score,
    level:           score !== null ? levelFor(score) : "unknown",
    breakdown: {
      completionRate:    total > 0 ? round3(completed / total)                         : null,
      logConsistency:    total > 0 ? round3(clamp(totalLogs / (total * 5)))            : null,
      hoursConsistency:  round3(clamp(1 - hoursStddev / 8)),
      responseRate:      total > 0 ? round3(clamp(responded / total))                 : null,
      anomalyPenalty:    -round3(penaltyExtreme + penaltyLate + penaltyFlagged),
    },
    signals: {
      totalAssignments:    total,
      completedAssignments: completed,
      cancelledAssignments: Number(assignments.cancelled_count  ?? 0),
      declinedAssignments:  Number(assignments.declined_count   ?? 0),
      totalLogs,
      avgHoursWorked:      Number(logs.avg_hours                ?? 0),
      lateSubmissions:     lateSubmits,
      extremeHoursLogs:    extremeH,
      flaggedLogs,
    },
    lastComputedAt: row.updated_at,
  };
}
