import { assertNonNegativeInteger } from "../../utils/validation.js";
import {
  getDashboardJob,
  getDashboardAssignments,
  getDashboardLogs,
  getDashboardMatchStats,
} from "./dashboard.repository.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STANDARD_WORK_HOURS = 8;
const SAFETY_KEYWORDS = ["unsafe", "injury", "hazard", "violation"];
const ISSUE_KEYWORDS = ["delay", "blocker", "stop", ...SAFETY_KEYWORDS];

function round(n, dec = 2) {
  const f = 10 ** dec;
  return Math.round(Number(n) * f) / f;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function daysBetween(later, earlier) {
  return Math.max(0, (later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function confidenceLevel(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  if (score >= 40) return "low";
  return "critical";
}

function logText(log) {
  return `${log.issues || ""} ${log.issues_blockers || ""} ${log.work_summary || ""}`.toLowerCase();
}

export async function getJobDashboard(jobId, authUser) {
  assertNonNegativeInteger(jobId, "jobId");

  const [job, assignments, logs, matchStats] = await Promise.all([
    getDashboardJob(jobId),
    getDashboardAssignments(jobId),
    getDashboardLogs(jobId),
    getDashboardMatchStats(jobId),
  ]);

  if (!job) {
    const err = new Error("Job not found");
    err.statusCode = 404;
    throw err;
  }

  if (authUser?.role === "contractor" && job.posted_by !== authUser.userId) {
    const err = new Error("Access forbidden");
    err.statusCode = 403;
    throw err;
  }

  const docGating = job.metadata?.doc_gating ?? null;
  const now = new Date();
  const payRate = toNum(job.pay_rate);
  const requiredSlots = toNum(job.required_slots);

  // — Assignment buckets (primary signal) —
  const activeAssignments = assignments.filter((a) =>
    ["accepted", "active"].includes(a.status)
  );
  const declinedOrCancelled = assignments.filter((a) =>
    ["declined", "cancelled"].includes(a.status)
  );

  // — Schedule drift (jobs signal) —
  const plannedStart = new Date(job.starts_at);
  const plannedEnd = new Date(job.ends_at);
  const hasStarted = assignments.some((a) => a.started_at);

  let scheduleRiskDays = 0;
  if (now > plannedEnd && job.status !== "closed") {
    scheduleRiskDays = round(daysBetween(now, plannedEnd), 0);
  } else if (!hasStarted && now > plannedStart) {
    scheduleRiskDays = round(daysBetween(now, plannedStart), 0);
  }

  // — Log signals —
  const flaggedLogs = logs.filter((l) =>
    ISSUE_KEYWORDS.some((kw) => logText(l).includes(kw))
  );
  const safetyFlaggedLogs = logs.filter((l) =>
    SAFETY_KEYWORDS.some((kw) => logText(l).includes(kw))
  );

  const silentWorkers = activeAssignments.filter((a) => {
    const workerLogs = logs.filter((l) => l.assignment_id === a.id);
    if (workerLogs.length === 0) return true;
    const lastLog = new Date(workerLogs[0].submitted_at);
    return daysBetween(now, lastLog) > 2;
  }).length;

  // — Financial signals —
  const openSlots = Math.max(0, requiredSlots - activeAssignments.length);
  const dailyMissingRevenue = openSlots * payRate * STANDARD_WORK_HOURS;
  const driftPenalty = scheduleRiskDays > 0
    ? dailyMissingRevenue * 0.25
    : 0;
  const profitLoss = round(dailyMissingRevenue + driftPenalty);

  // — Cause drivers (logs + assignments) —
  const cause = [];

  if (openSlots > 0) {
    cause.push({
      label: "Unfilled slots",
      impact: round(dailyMissingRevenue),
      metric: `${openSlots} of ${requiredSlots || "?"} open`,
      source: "assignments",
    });
  }

  if (scheduleRiskDays > 0) {
    cause.push({
      label: "Schedule overrun",
      impact: null,
      metric: `${scheduleRiskDays}d behind`,
      source: "jobs",
    });
  }

  if (safetyFlaggedLogs.length > 0) {
    cause.push({
      label: "Safety issues flagged",
      impact: null,
      metric: `${safetyFlaggedLogs.length} log(s)`,
      source: "logs",
    });
  } else if (flaggedLogs.length > 0) {
    cause.push({
      label: "Field issues flagged",
      impact: null,
      metric: `${flaggedLogs.length} log(s)`,
      source: "logs",
    });
  }

  // — Execution —
  const conflicts = declinedOrCancelled.length + safetyFlaggedLogs.length;
  const productionDelta =
    requiredSlots > 0
      ? round(((activeAssignments.length / requiredSlots) * 100) - 100, 0)
      : null;

  // — Action items (logs + assignments as primary signal) —
  const action = [];

  if (openSlots > 0) {
    action.push({
      id: "fill-slots",
      priority: "high",
      label: `Assign ${openSlots} worker(s) — ${matchStats.high_quality_matches} strong match(es) available`,
      cta: "View matches",
      route: `/job-matches/${job.id}`,
    });
  }

  if (scheduleRiskDays > 0) {
    action.push({
      id: "schedule-risk",
      priority: "high",
      label: `${scheduleRiskDays}d behind schedule — intervention needed`,
      cta: "Review schedule",
      route: null,
    });
  }

  if (safetyFlaggedLogs.length > 0) {
    action.push({
      id: "safety-flags",
      priority: "critical",
      label: `${safetyFlaggedLogs.length} safety flag(s) in field logs`,
      cta: "Review logs",
      route: null,
    });
  } else if (flaggedLogs.length > 0) {
    action.push({
      id: "flagged-logs",
      priority: "medium",
      label: `${flaggedLogs.length} field log(s) contain issue flags`,
      cta: "Review logs",
      route: null,
    });
  }

  if (silentWorkers > 0) {
    action.push({
      id: "silent-workers",
      priority: "medium",
      label: `${silentWorkers} active worker(s) haven't logged in 2+ days`,
      cta: "Contact workers",
      route: null,
    });
  }

  if (docGating?.state === "AT_RISK") {
    action.push({
      id: "doc-at-risk",
      priority: "critical",
      label: "Rejected document requires attention before dispatch can proceed",
      cta: "Review documents",
      route: `/api/docs/project/${job.id}`,
    });
  } else if (docGating?.state === "LOCKED") {
    action.push({
      id: "doc-locked",
      priority: "high",
      label: "Pending documents require review before dispatch can proceed",
      cta: "Review documents",
      route: `/api/docs/project/${job.id}`,
    });
  }

  if (action.length === 0) {
    action.push({
      id: "all-clear",
      priority: "info",
      label: "No immediate actions required — job is on track",
      cta: null,
      route: null,
    });
  }

  // — Forecast (derived from assignments + logs) —
  const projectedDelay = scheduleRiskDays + (openSlots > 0 ? Math.ceil(openSlots / 2) : 0);
  const uncertainty =
    logs.length === 0 ? "high" : logs.length < 5 ? "medium" : "low";

  // — Confidence score —
  let score = 100;
  score -= openSlots * 8;
  score -= scheduleRiskDays * 5;
  score -= conflicts * 6;
  score -= flaggedLogs.length * 3;
  score -= silentWorkers * 4;
  if (logs.length === 0 && assignments.length > 0) score -= 10;
  score = clamp(Math.round(score), 0, 100);

  return {
    job: {
      id: toNum(job.id),
      title: job.title,
      status: job.status,
      startsAt: job.starts_at,
      endsAt: job.ends_at,
      payRate: payRate > 0 ? payRate : null,
      requiredSlots: requiredSlots > 0 ? requiredSlots : null,
      docGating,
    },
    hero: {
      profitLoss: profitLoss > 0 ? profitLoss : null,
      scheduleRisk: scheduleRiskDays > 0 ? scheduleRiskDays : null,
      executionConfidence: score,
    },
    cause: cause.slice(0, 3),
    action: action.slice(0, 5),
    execution: {
      conflicts: conflicts,
      productionDelta: productionDelta,
      activeAssignments: activeAssignments.length,
    },
    forecast: {
      projectedDelay: projectedDelay > 0 ? projectedDelay : null,
      uncertainty: uncertainty,
    },
    confidence: {
      score: score,
      level: confidenceLevel(score),
    },
    matchPool: {
      totalMatches: toNum(matchStats.total_matches),
      highQualityMatches: toNum(matchStats.high_quality_matches),
    },
  };
}
