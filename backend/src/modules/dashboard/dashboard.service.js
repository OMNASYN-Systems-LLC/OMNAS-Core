import { assertNonNegativeInteger } from "../../utils/validation.js";
import { getEscalationQueue } from "../escalations/service.js";
import { getJobErosion } from "../financial/financial.service.js";
import { getJobRecommendations } from "../recommendations/service.js";
import { getJobSchedule } from "../scheduling/service.js";
import { getDashboardJobActivity } from "./dashboard.repository.js";

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readinessPercent(status) {
  if (status === "READY") return 100;
  if (status === "AT_RISK") return 70;
  return 40;
}

function dataConfidence({ financial, schedule, recommendations, activity }) {
  const signals = [
    Number(financial?.events?.length || 0) > 0,
    Number(schedule?.audit?.categoryAudits?.length || 0) > 0,
    Number(recommendations?.gapRecommendations?.length || 0) >= 0,
    Number(activity?.logs?.total_logs || 0) > 0
  ];

  const ratio = signals.filter(Boolean).length / signals.length;
  if (ratio >= 0.75) return 1;
  if (ratio >= 0.5) return 0.7;
  return 0.4;
}

export async function getProjectDashboard(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const activity = await getDashboardJobActivity(jobId, contractorUserId);
  if (!activity) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const [financial, schedule, recommendations, escalationQueue] = await Promise.all([
    getJobErosion(jobId, contractorUserId),
    getJobSchedule(jobId, contractorUserId),
    getJobRecommendations(jobId, contractorUserId),
    getEscalationQueue("pending")
  ]);

  const categoryAudits = schedule?.audit?.categoryAudits || [];
  const delayedCategories = categoryAudits.filter((item) => (item.flags || []).includes("DELAY"));
  const missingWork = categoryAudits.filter((item) => (item.flags || []).includes("MISSING") || (item.flags || []).includes("MISSING_WORK"));
  const scheduleDriftDays = Number((categoryAudits
    .filter((item) => Number(item.variance || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.variance || 0)) / 20, 0)).toFixed(2));

  const tradeSet = new Set((schedule?.tradeCoverage || []).map((item) => normalize(item.category)));
  const linkedEscalations = (escalationQueue || []).filter((event) => {
    const taskId = normalize(event.task_id);
    return taskId && [...tradeSet].some((trade) => taskId.includes(trade));
  });

  const fallbackEscalations = schedule?.lookaheadAdjustment?.escalations || [];
  const escalationsCount = linkedEscalations.length > 0
    ? linkedEscalations.filter((item) => item.severity === "AMBER").length
    : fallbackEscalations.length;

  const hardLocksCount = (schedule?.lookaheadAdjustment?.manualOverridesRequired || []).filter((item) => item.severity === "RED").length;
  const congestionWarnings = (schedule?.lookaheadAdjustment?.congestionWarnings || []).length;
  const fatigueWarnings = (schedule?.lookaheadAdjustment?.fatigueWarnings || []).length;
  const safetyFlags = (schedule?.lookaheadAdjustment?.safetyConflicts || []).filter((item) => item.severity === "CRITICAL").length;

  const autoResolutionsCount = (schedule?.lookaheadAdjustment?.autoResolutions || []).length;
  const pendingOverridesCount = (schedule?.lookaheadAdjustment?.manualOverridesRequired || []).length;
  const pendingEscalationsCount = linkedEscalations.length > 0 ? linkedEscalations.length : fallbackEscalations.length;

  const erosionPct = toNumber(financial?.thresholds?.erosionRatio, 0);
  let score = 100;
  score -= scheduleDriftDays * 4;
  score -= erosionPct * 0.7;
  score -= escalationsCount * 6;
  score -= hardLocksCount * 10;
  score -= safetyFlags * 12;
  score = clamp(Math.round(score), 0, 100);

  const status = score >= 75 ? "GREEN" : score >= 45 ? "YELLOW" : "RED";
  const projectedDelayDays = Number((scheduleDriftDays + delayedCategories.length * 0.5 + hardLocksCount * 1.25).toFixed(2));
  const dailyLoss = Number(financial?.totalDailyErosion || 0);
  const projectedLoss = Number((toNumber(financial?.weeklyProjection, 0) + dailyLoss * projectedDelayDays).toFixed(2));

  const actions = [
    ...fallbackEscalations.slice(0, 5).map((item) => ({
      type: "ESCALATION",
      severity: item.severity || "AMBER",
      description: item.reason || "Escalation pending",
      requiredAction: item.suggestedAction || "Superintendent decision required"
    })),
    ...(schedule?.lookaheadAdjustment?.manualOverridesRequired || []).slice(0, 5).map((item) => ({
      type: "OVERRIDE",
      severity: item.severity || "AMBER",
      description: item.reason || "Manual override required",
      requiredAction: item.suggestedAction || "Review and approve adjustment"
    }))
  ];

  const topDriver = financial?.topDrivers?.[0];
  if (topDriver) {
    actions.push({
      type: "FINANCIAL_DRIVER",
      severity: status === "RED" ? "RED" : "YELLOW",
      description: `${topDriver.driverId} driving $${Number(topDriver.dailyImpactUsd || 0).toLocaleString()}/day loss`,
      requiredAction: "Mitigate primary cost driver"
    });
  }

  const confidence = dataConfidence({ financial, schedule, recommendations, activity });

  return {
    hero: {
      healthScore: score,
      status,
      headline: `Project losing $${dailyLoss.toLocaleString()}/day`
    },
    financial: {
      dailyLoss,
      weeklyProjection: Number(financial?.weeklyProjection || 0),
      topDrivers: financial?.topDrivers || []
    },
    execution: {
      scheduleDriftDays,
      readinessPercent: readinessPercent(schedule?.readinessStatus),
      delayedCategoriesCount: delayedCategories.length,
      missingWorkCount: missingWork.length
    },
    risks: {
      escalationsCount,
      hardLocksCount,
      congestionWarnings,
      fatigueWarnings,
      safetyFlags
    },
    automation: {
      autoResolutionsCount,
      pendingOverridesCount,
      pendingEscalationsCount
    },
    forecast: {
      projectedDelayDays,
      projectedLoss
    },
    actions,
    confidence,
    context: {
      fieldLogsToday: Number(activity.logs?.today_logs || 0),
      fieldLogsTotal: Number(activity.logs?.total_logs || 0),
      lastLogAt: activity.logs?.last_log_at || null,
      workforceGapCount: (recommendations?.gapRecommendations || []).length
    }
  };
}
