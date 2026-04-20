import { assertNonNegativeInteger } from "../../utils/validation.js";
import { getEscalationQueue } from "../escalations/service.js";
import { getJobErosion } from "../financial/financial.service.js";
import { getJobRecommendations } from "../recommendations/service.js";
import { getJobSchedule } from "../scheduling/service.js";
import { getJobActivitySnapshot } from "./analytics.repository.js";

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

function deriveReadinessPercent(readinessStatus) {
  if (readinessStatus === "READY") return 100;
  if (readinessStatus === "AT_RISK") return 70;
  return 40;
}

export async function getProjectCommand(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const activity = await getJobActivitySnapshot(jobId, contractorUserId);
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
  const scheduleDriftDays = Number(
    (categoryAudits
      .filter((item) => Number(item.variance || 0) < 0)
      .reduce((sum, item) => sum + Math.abs(Number(item.variance || 0)) / 20, 0)
    ).toFixed(2)
  );

  const tradeSet = new Set((schedule?.tradeCoverage || []).map((item) => normalize(item.category)));
  const linkedEscalations = (escalationQueue || []).filter((event) => {
    const taskId = normalize(event.task_id);
    if (!taskId) return false;
    return [...tradeSet].some((trade) => taskId.includes(trade));
  });

  const fallbackEscalations = schedule?.lookaheadAdjustment?.escalations || [];
  const escalationsCount = linkedEscalations.length > 0 ? linkedEscalations.filter((item) => item.severity === "AMBER").length : fallbackEscalations.length;

  const hardLocksCount = (schedule?.lookaheadAdjustment?.manualOverridesRequired || []).filter((item) => item.severity === "RED").length;
  const congestionWarnings = (schedule?.lookaheadAdjustment?.congestionWarnings || []).length;
  const fatigueWarnings = (schedule?.lookaheadAdjustment?.fatigueWarnings || []).length;

  const autoResolutionsCount = (schedule?.lookaheadAdjustment?.autoResolutions || []).length;
  const pendingOverridesCount = (schedule?.lookaheadAdjustment?.manualOverridesRequired || []).length;
  const pendingEscalationsCount = linkedEscalations.length > 0 ? linkedEscalations.length : fallbackEscalations.length;

  const readinessPercent = deriveReadinessPercent(schedule?.readinessStatus);
  const erosionPct = toNumber(financial?.thresholds?.erosionRatio, 0);
  const safetyCritical = (schedule?.lookaheadAdjustment?.safetyConflicts || []).filter((item) => item.severity === "CRITICAL").length;

  let healthScore = 100;
  healthScore -= scheduleDriftDays * 4;
  healthScore -= erosionPct * 0.7;
  healthScore -= escalationsCount * 6;
  healthScore -= hardLocksCount * 10;
  healthScore -= safetyCritical * 12;
  healthScore = clamp(Math.round(healthScore), 0, 100);

  const healthStatus = healthScore >= 75 ? "GREEN" : healthScore >= 45 ? "YELLOW" : "RED";

  const projectedDelayDays = Number((scheduleDriftDays + delayedCategories.length * 0.5 + hardLocksCount * 1.25).toFixed(2));
  const projectedLoss = Number((toNumber(financial?.weeklyProjection, 0) + toNumber(financial?.dailyLoss, financial?.totalDailyErosion || 0) * projectedDelayDays).toFixed(2));

  const actions = [];
  for (const escalation of fallbackEscalations.slice(0, 5)) {
    actions.push({
      type: "ESCALATION",
      severity: escalation.severity || "AMBER",
      description: escalation.reason,
      requiredAction: escalation.suggestedAction || "Superintendent decision required"
    });
  }

  for (const override of (schedule?.lookaheadAdjustment?.manualOverridesRequired || []).slice(0, 5)) {
    actions.push({
      type: "OVERRIDE",
      severity: override.severity || "AMBER",
      description: override.reason,
      requiredAction: override.suggestedAction || "Review and approve adjustment"
    });
  }

  const topDriverAction = financial?.topDrivers?.[0];
  if (topDriverAction) {
    actions.push({
      type: "FINANCIAL_DRIVER",
      severity: healthStatus === "RED" ? "RED" : "YELLOW",
      description: `${topDriverAction.driverId} driving $${Number(topDriverAction.dailyImpactUsd || 0).toLocaleString()}/day loss`,
      requiredAction: "Mitigate primary cost driver in next planning cycle"
    });
  }

  const financialView = {
    dailyLoss: Number(financial?.totalDailyErosion || 0),
    weeklyProjection: Number(financial?.weeklyProjection || 0),
    topDrivers: financial?.topDrivers || []
  };

  return {
    health: {
      score: healthScore,
      status: healthStatus
    },
    financial: financialView,
    execution: {
      scheduleDriftDays,
      readinessPercent,
      delayedCategoriesCount: delayedCategories.length,
      missingWorkCount: missingWork.length
    },
    risks: {
      escalationsCount,
      hardLocksCount,
      congestionWarnings,
      fatigueWarnings,
      safetyFlags: safetyCritical
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
    context: {
      fieldLogsToday: Number(activity.logs?.today_logs || 0),
      fieldLogsTotal: Number(activity.logs?.total_logs || 0),
      lastLogAt: activity.logs?.last_log_at || null,
      workforceGapCount: (recommendations?.gapRecommendations || []).length
    }
  };
}
