import {
  getAssignmentsForJob,
  getJobForCommand,
  getLogsForJob,
  getMatchCountsForJob
} from "./analytics.repository.js";
import { assertNonNegativeInteger } from "../../utils/validation.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STANDARD_WORK_HOURS = 8;
const ISSUE_KEYWORDS = ["delay", "unsafe", "injury", "blocker", "stop", "hazard", "violation"];

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function daysBetween(later, earlier) {
  return Math.max(0, (later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function classifyStatus(score) {
  if (score >= 80) return "healthy";
  if (score >= 60) return "caution";
  if (score >= 40) return "warning";
  return "critical";
}

function computeScheduleDrift(job, assignments, now) {
  const plannedStart = new Date(job.starts_at);
  const plannedEnd = new Date(job.ends_at);

  if (now < plannedStart) {
    return { driftDays: 0, pastDue: false, phase: "pre-start" };
  }

  const anyStarted = assignments.some((a) => a.started_at !== null);
  if (!anyStarted && now > plannedStart) {
    return { driftDays: round(daysBetween(now, plannedStart), 1), pastDue: true, phase: "not-started" };
  }

  if (now > plannedEnd && job.status !== "closed") {
    return { driftDays: round(daysBetween(now, plannedEnd), 1), pastDue: true, phase: "overrun" };
  }

  return { driftDays: 0, pastDue: false, phase: "in-progress" };
}

function computeReadiness(job, assignments) {
  const requiredSlots = Number(job.required_slots || 0);
  if (requiredSlots === 0) {
    return { readinessPercent: 0, acceptedCount: 0, requiredSlots: 0, openSlots: 0 };
  }

  const accepted = assignments.filter((a) => ["accepted", "active", "completed"].includes(a.status)).length;
  const readinessPercent = Math.min(100, Math.round((accepted / requiredSlots) * 100));
  return {
    readinessPercent,
    acceptedCount: accepted,
    requiredSlots,
    openSlots: Math.max(0, requiredSlots - accepted)
  };
}

function detectIssueFromLog(log) {
  const blob = `${log.issues ?? ""} ${log.work_summary ?? ""}`.toLowerCase();
  return ISSUE_KEYWORDS.find((kw) => blob.includes(kw)) ?? null;
}

function computeRisks(assignments, logs) {
  const declined = assignments.filter((a) => a.status === "declined");
  const cancelled = assignments.filter((a) => a.status === "cancelled");

  const flaggedLogs = logs.filter((log) => log.issues && log.issues.trim().length > 0);
  const safetyFlagged = logs.filter((log) => {
    const kw = detectIssueFromLog(log);
    return kw && ["unsafe", "injury", "hazard", "violation"].includes(kw);
  });

  return {
    escalations: flaggedLogs.length,
    hardLocks: cancelled.length + declined.length,
    congestion: 0,
    safety: safetyFlagged.length,
    details: {
      declinedAssignments: declined.length,
      cancelledAssignments: cancelled.length,
      flaggedLogs: flaggedLogs.length,
      safetyIncidents: safetyFlagged.length
    }
  };
}

function computeAutomation(assignments) {
  const offered = assignments.filter((a) => a.status === "offered");
  const autoResolved = assignments.filter((a) => a.status === "declined" && a.responded_at !== null).length;

  return {
    autoResolutions: autoResolved,
    pendingOverrides: offered.length
  };
}

function computeFinancial(job, assignments, drift, readiness) {
  const payRate = Number(job.pay_rate || 0);
  const missingSlotsLoss = readiness.openSlots * payRate * STANDARD_WORK_HOURS;
  const driftLoss = drift.driftDays * (readiness.requiredSlots || 1) * payRate * STANDARD_WORK_HOURS;

  const dailyLoss = round(missingSlotsLoss + (drift.driftDays > 0 ? missingSlotsLoss * 0.25 : 0));
  const weeklyProjection = round(dailyLoss * 7);

  const topDrivers = [];
  if (readiness.openSlots > 0) {
    topDrivers.push({
      label: "Unfilled workforce slots",
      impact: round(missingSlotsLoss),
      metric: `${readiness.openSlots} open slot(s)`
    });
  }
  if (drift.driftDays > 0) {
    topDrivers.push({
      label: `Schedule ${drift.phase}`,
      impact: round(driftLoss),
      metric: `${drift.driftDays} day(s) drift`
    });
  }
  const declined = assignments.filter((a) => a.status === "declined").length;
  if (declined > 0) {
    topDrivers.push({
      label: "Declined assignments",
      impact: round(declined * payRate * STANDARD_WORK_HOURS),
      metric: `${declined} decline(s)`
    });
  }

  topDrivers.sort((a, b) => b.impact - a.impact);

  return { dailyLoss, weeklyProjection, topDrivers: topDrivers.slice(0, 5) };
}

function computeForecast(financial, drift, readiness) {
  const baseDrift = drift.driftDays || 0;
  const readinessFactor = readiness.requiredSlots > 0
    ? 1 + (readiness.openSlots / readiness.requiredSlots)
    : 1;
  const projectedDelayDays = round(baseDrift * readinessFactor + readiness.openSlots * 0.5, 1);
  const projectedLoss = round(financial.dailyLoss * Math.max(1, projectedDelayDays));

  return { projectedDelayDays, projectedLoss };
}

function computeMissingWork(job, assignments, logs, now) {
  const activeAssignments = assignments.filter((a) => ["accepted", "active"].includes(a.status));
  if (activeAssignments.length === 0) {
    return { missingLogs: 0, silentWorkers: [] };
  }

  const staleCutoff = new Date(now.getTime() - 2 * MS_PER_DAY);
  const silentWorkers = [];

  for (const assignment of activeAssignments) {
    const logsForAssignment = logs.filter((log) => log.assignment_id === assignment.id);
    const mostRecent = logsForAssignment[0]
      ? new Date(logsForAssignment[0].log_date)
      : assignment.started_at
        ? new Date(assignment.started_at)
        : new Date(assignment.offered_at);

    if (mostRecent < staleCutoff) {
      silentWorkers.push({
        assignmentId: assignment.id,
        workerName: assignment.first_name ? `${assignment.first_name} ${assignment.last_name}` : "Unknown",
        lastLogDate: logsForAssignment[0]?.log_date ?? null,
        daysSilent: round(daysBetween(now, mostRecent), 1)
      });
    }
  }

  return { missingLogs: silentWorkers.length, silentWorkers };
}

function computeHealth(readiness, drift, risks, financial) {
  let score = 100;
  score -= (100 - readiness.readinessPercent) * 0.35;
  score -= drift.driftDays * 3;
  score -= risks.escalations * 4;
  score -= risks.safety * 10;
  score -= risks.hardLocks * 5;
  if (financial.dailyLoss > 0) {
    score -= Math.min(15, financial.dailyLoss / 500);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, status: classifyStatus(score) };
}

function buildActions(job, assignments, readiness, drift, risks, missingWork, role) {
  const actions = [];

  if (readiness.openSlots > 0) {
    actions.push({
      id: "fill-open-slots",
      priority: "high",
      label: `Assign ${readiness.openSlots} worker(s) to fill open slot(s)`,
      cta: role === "contractor" ? "Open matches" : "Awaiting contractor",
      route: role === "contractor" ? `/job-matches/${job.id}` : null
    });
  }

  if (drift.pastDue) {
    actions.push({
      id: "resolve-drift",
      priority: "high",
      label: `Resolve ${drift.driftDays} day(s) of schedule drift (${drift.phase})`,
      cta: role === "contractor" ? "Reschedule" : "Awaiting reschedule",
      route: null
    });
  }

  const pending = assignments.filter((a) => a.status === "offered");
  if (pending.length > 0) {
    actions.push({
      id: "pending-offers",
      priority: "medium",
      label: `${pending.length} offer(s) pending worker response`,
      cta: "Review",
      route: null
    });
  }

  if (risks.safety > 0) {
    actions.push({
      id: "safety-review",
      priority: "high",
      label: `${risks.safety} safety-flagged log(s) require review`,
      cta: "Review logs",
      route: null
    });
  }

  if (missingWork.missingLogs > 0) {
    actions.push({
      id: "missing-logs",
      priority: "medium",
      label: `${missingWork.missingLogs} worker(s) have not logged recently`,
      cta: "Contact workers",
      route: null
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "all-clear",
      priority: "info",
      label: "No decisions required. System is stable.",
      cta: null,
      route: null
    });
  }

  return actions;
}

function buildClientView(command) {
  return {
    health: command.health,
    financial: {
      dailyLoss: null,
      weeklyProjection: null,
      topDrivers: command.financial.topDrivers.map((d) => ({ label: d.label, metric: d.metric }))
    },
    execution: {
      scheduleDriftDays: command.execution.scheduleDriftDays,
      readinessPercent: command.execution.readinessPercent,
      missingWork: { missingLogs: command.execution.missingWork.missingLogs, silentWorkers: [] }
    },
    risks: {
      escalations: command.risks.escalations,
      hardLocks: command.risks.hardLocks,
      congestion: command.risks.congestion,
      safety: command.risks.safety
    },
    automation: null,
    forecast: command.forecast,
    actions: command.actions.filter((a) => a.priority === "high")
  };
}

export async function getJobCommand(jobId, authUser) {
  assertNonNegativeInteger(jobId, "jobId");

  const job = await getJobForCommand(jobId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const role = authUser?.role ?? "contractor";
  const isOwningContractor = role === "contractor" && job.posted_by === authUser?.userId;
  if (role === "contractor" && !isOwningContractor) {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }

  const [assignments, logs, matchStats] = await Promise.all([
    getAssignmentsForJob(jobId),
    getLogsForJob(jobId),
    getMatchCountsForJob(jobId)
  ]);

  const now = new Date();
  const drift = computeScheduleDrift(job, assignments, now);
  const readiness = computeReadiness(job, assignments);
  const risks = computeRisks(assignments, logs);
  const automation = computeAutomation(assignments);
  const financial = computeFinancial(job, assignments, drift, readiness);
  const missingWork = computeMissingWork(job, assignments, logs, now);
  const forecast = computeForecast(financial, drift, readiness);
  const health = computeHealth(readiness, drift, risks, financial);

  const command = {
    job: {
      id: Number(job.id),
      title: job.title,
      status: job.status,
      startsAt: job.starts_at,
      endsAt: job.ends_at,
      payRate: Number(job.pay_rate)
    },
    health,
    financial,
    execution: {
      scheduleDriftDays: drift.driftDays,
      phase: drift.phase,
      readinessPercent: readiness.readinessPercent,
      acceptedCount: readiness.acceptedCount,
      requiredSlots: readiness.requiredSlots,
      openSlots: readiness.openSlots,
      missingWork,
      matchPool: {
        totalMatches: Number(matchStats.total_matches),
        avgScore: Number(matchStats.avg_score),
        topScore: Number(matchStats.top_score)
      }
    },
    risks,
    automation,
    forecast,
    actions: []
  };

  command.actions = buildActions(job, assignments, readiness, drift, risks, missingWork, role);

  if (role === "client") {
    return buildClientView(command);
  }

  return command;
}
