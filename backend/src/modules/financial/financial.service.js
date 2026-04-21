import { assertNonNegativeInteger } from "../../utils/validation.js";
import { getJobSchedule } from "../scheduling/service.js";
import {
  getFinancialContext,
  getFinancialProfileByJob,
  insertFinancialAuditLog,
  insertProfitErosionEvents,
  listProfitErosionEvents,
  upsertFinancialProfile
} from "./financial.repository.js";

function normalizeCategory(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateDailyBurnRate(profile) {
  if (Number(profile.daily_burn_rate || 0) > 0) {
    return Number(profile.daily_burn_rate);
  }

  return (Number(profile.contract_value || 0) * 0.08) / Math.max(1, Number(profile.total_duration_days || 1));
}

function confidenceFromEvidence({ hasLogs, hasProduction, hasEvidence }) {
  if (hasLogs && hasProduction && hasEvidence) return 1.0;
  if (hasLogs) return 0.7;
  return 0.4;
}

function deriveRiskMultiplier(item) {
  if (String(item.type || "").includes("safety")) return 0.3;
  if (String(item.type || "").includes("escalation")) return 0.4;
  return 0.2;
}

function buildDefaultProfile(job) {
  const startsAt = new Date(job.starts_at);
  const endsAt = new Date(job.ends_at);
  const totalDurationDays = Math.max(1, Math.ceil((endsAt - startsAt) / (1000 * 60 * 60 * 24)));
  const metadata = job.metadata || {};
  const contractValue = Number(metadata.contractValue || metadata.contract_value || (Number(job.pay_rate || 0) * totalDurationDays * 8));

  return {
    jobId: job.id,
    contractValue: Number.isFinite(contractValue) ? contractValue : 0,
    totalDurationDays,
    dailyBurnRate: metadata.dailyBurnRate || metadata.daily_burn_rate || null,
    laborBurdenMultiplier: Number(metadata.laborBurdenMultiplier || metadata.labor_burden_multiplier || 1.25),
    criticalPathWeight: Number(metadata.criticalPathWeight || metadata.critical_path_weight || 1.0)
  };
}

function getPrimaryCause(breakdown) {
  const ranking = [
    { key: "timeLoss", value: breakdown.timeLoss, label: "critical-path time loss" },
    { key: "inefficiency", value: breakdown.inefficiency, label: "labor inefficiency" },
    { key: "risk", value: breakdown.risk, label: "risk exposure" }
  ].sort((a, b) => b.value - a.value);

  return ranking[0]?.label || "unknown drivers";
}

export async function runDailyErosionCalculation(projectId, contractorUserId) {
  assertNonNegativeInteger(projectId, "projectId");

  const context = await getFinancialContext(projectId, contractorUserId);
  if (!context.job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const existingProfile = await getFinancialProfileByJob(projectId);
  const profile = existingProfile || (await upsertFinancialProfile(buildDefaultProfile(context.job)));

  if (!profile) {
    const error = new Error("Unable to initialize project financial profile");
    error.statusCode = 500;
    throw error;
  }

  const schedule = await getJobSchedule(projectId, contractorUserId);
  const categoryAudits = schedule?.audit?.categoryAudits || [];
  const productivityFactors = schedule?.lookaheadAdjustment?.productivityFactors || [];
  const congestionWarnings = schedule?.lookaheadAdjustment?.congestionWarnings || [];
  const safetyConflicts = schedule?.lookaheadAdjustment?.safetyConflicts || [];
  const escalations = schedule?.lookaheadAdjustment?.escalations || [];

  const dailyBurnRate = calculateDailyBurnRate(profile);
  const laborBurdenMultiplier = Number(profile.labor_burden_multiplier || 1.25);
  const criticalPathWeight = Number(profile.critical_path_weight || 1.0);
  const criticalPathSet = new Set((context.job.metadata?.criticalPathCategories || []).map(normalizeCategory));
  const floatDaysMap = context.job.metadata?.floatDaysByCategory || {};

  const avgHourlyBaseLabor = Number(context.job.metadata?.avgHourlyLaborCost || context.job.pay_rate || 0);
  const totalDailyLaborCost = Math.max(0, avgHourlyBaseLabor * Math.max(1, Number(context.activeWorkers || 0)) * 8 * laborBurdenMultiplier);

  const events = [];
  const missingData = [];

  for (const item of categoryAudits) {
    const category = normalizeCategory(item.category);
    const factor = productivityFactors.find((entry) => normalizeCategory(entry.category) === category);
    const plannedProductionRaw = Number(item.adjustedExpectedProgress ?? item.expectedProgress ?? 0);
    const weatherMultiplier = Number(item.weatherMultiplier ?? 1);
    const plannedProduction = plannedProductionRaw * weatherMultiplier;
    const actualProduction = Number(item.actualProgress ?? 0);

    if (plannedProduction <= 0) {
      missingData.push({ category, reason: "planned_production_zero" });
      continue;
    }

    const productionGapRatio = clamp((plannedProduction - actualProduction) / plannedProduction, 0, 1);
    const inefficiencyCost = Math.max(0, productionGapRatio * totalDailyLaborCost);

    const hasLogs = Array.isArray(item.logsUsed) && item.logsUsed.length > 0;
    const hasEvidence = Boolean(item.explanation || factor?.effectiveProductivity);
    const inefficiencyConfidence = confidenceFromEvidence({
      hasLogs,
      hasProduction: plannedProduction > 0 && actualProduction >= 0,
      hasEvidence
    });

    if (inefficiencyCost > 0) {
      events.push({
        category: "INEFFICIENCY",
        driverId: category,
        dailyImpactUsd: toMoney(inefficiencyCost),
        confidenceScore: inefficiencyConfidence,
        description: `Labor inefficiency detected for ${category} after weather-adjusted production baseline`,
        metadata: {
          plannedProduction,
          actualProduction,
          weatherMultiplier,
          totalDailyLaborCost,
          productionGapRatio
        }
      });
    }

    const scheduleDriftDays = Math.max(0, Number(item.variance || 0) < 0 ? Math.abs(Number(item.variance || 0)) / 20 : 0);
    const floatDays = Number(floatDaysMap[category] ?? floatDaysMap[item.category] ?? 0);
    const onCriticalPath = criticalPathSet.has(category) || Boolean(item.criticalPath);

    const inefficiencyRecorded = inefficiencyCost > 0;
    const allowTimeLoss = onCriticalPath && scheduleDriftDays > 0 && floatDays <= 0 && (!inefficiencyRecorded || onCriticalPath);

    if (allowTimeLoss) {
      const timeLossCost = scheduleDriftDays * dailyBurnRate * criticalPathWeight;
      events.push({
        category: "TIME_LOSS",
        driverId: category,
        dailyImpactUsd: toMoney(timeLossCost),
        confidenceScore: confidenceFromEvidence({ hasLogs, hasProduction: true, hasEvidence: onCriticalPath }),
        description: `Critical path drift causing fixed-cost burn (${scheduleDriftDays.toFixed(2)} days drift)`,
        metadata: {
          scheduleDriftDays,
          dailyBurnRate,
          criticalPathWeight,
          floatDays,
          onCriticalPath
        }
      });
    }
  }

  for (const warning of congestionWarnings) {
    const multiplier = deriveRiskMultiplier({ type: "congestion" });
    events.push({
      category: "RISK",
      driverId: normalizeCategory(warning.category || "congestion"),
      dailyImpactUsd: toMoney(dailyBurnRate * multiplier),
      confidenceScore: 0.7,
      description: `Congestion risk (${warning.message})`,
      metadata: { source: "congestion", multiplier, warning }
    });
  }

  for (const conflict of safetyConflicts) {
    const multiplier = deriveRiskMultiplier({ type: "safety" });
    events.push({
      category: "RISK",
      driverId: String(conflict.taskAId || conflict.tradeA || "safety_conflict"),
      dailyImpactUsd: toMoney(dailyBurnRate * multiplier),
      confidenceScore: 1.0,
      description: `Safety warning: ${conflict.message || `${conflict.tradeA} vs ${conflict.tradeB}`}`,
      metadata: { source: "safety", multiplier, conflict }
    });
  }

  for (const escalation of escalations) {
    const multiplier = Math.max(0.4, deriveRiskMultiplier({ type: "escalation" }));
    events.push({
      category: "RISK",
      driverId: String(escalation.taskId || "escalation"),
      dailyImpactUsd: toMoney(dailyBurnRate * multiplier),
      confidenceScore: 1.0,
      description: `Escalation risk: ${escalation.reason}`,
      metadata: { source: "escalation", multiplier, escalation }
    });
  }

  const insertedEvents = await insertProfitErosionEvents(profile.project_id, events);

  if (missingData.length > 0) {
    await insertFinancialAuditLog(profile.project_id, "warning", "Missing production inputs during erosion calculation", { missingData });
  }

  await insertFinancialAuditLog(profile.project_id, "ok", "Daily erosion calculation completed", {
    eventsStored: insertedEvents.length,
    dailyBurnRate,
    totalDailyLaborCost
  });

  const latestEvents = await listProfitErosionEvents(profile.project_id, 120);
  const nowIso = new Date().toISOString().slice(0, 10);
  const todayEvents = latestEvents.filter((event) => String(event.created_at).slice(0, 10) === nowIso);

  const breakdown = {
    timeLoss: toMoney(todayEvents.filter((event) => event.category === "TIME_LOSS").reduce((sum, event) => sum + Number(event.daily_impact_usd || 0), 0)),
    inefficiency: toMoney(todayEvents.filter((event) => event.category === "INEFFICIENCY").reduce((sum, event) => sum + Number(event.daily_impact_usd || 0), 0)),
    risk: toMoney(todayEvents.filter((event) => event.category === "RISK").reduce((sum, event) => sum + Number(event.daily_impact_usd || 0), 0))
  };

  const totalDailyErosion = toMoney(breakdown.timeLoss + breakdown.inefficiency + breakdown.risk);
  const baseline = Math.max(1, dailyBurnRate + totalDailyLaborCost);
  const erosionRatio = totalDailyErosion / baseline;

  const criticalPathImpacted = todayEvents.some((event) => event.category === "TIME_LOSS");
  let alertLevel = "IGNORE";
  if (erosionRatio >= 0.02 && erosionRatio <= 0.05) alertLevel = "AMBER";
  if (erosionRatio > 0.05 || criticalPathImpacted) alertLevel = "RED";

  const topDrivers = todayEvents
    .sort((a, b) => Number(b.daily_impact_usd || 0) - Number(a.daily_impact_usd || 0))
    .slice(0, 3)
    .map((event) => ({
      driverId: event.driver_id,
      category: event.category,
      dailyImpactUsd: Number(event.daily_impact_usd || 0),
      description: event.description
    }));

  const aggregateConfidence = todayEvents.length > 0
    ? Number((todayEvents.reduce((sum, event) => sum + Number(event.confidence_score || 0), 0) / todayEvents.length).toFixed(3))
    : 0.4;

  return {
    totalDailyErosion,
    breakdown,
    confidenceScore: aggregateConfidence,
    topDrivers,
    events: todayEvents,
    alertLevel,
    weeklyProjection: toMoney(totalDailyErosion * 7),
    executiveSummary: `Project losing $${totalDailyErosion.toLocaleString()} per day due to ${getPrimaryCause(breakdown)}.`,
    thresholds: {
      erosionRatio: Number((erosionRatio * 100).toFixed(2)),
      baselineDailyCost: toMoney(baseline),
      criticalPathImpacted
    }
  };
}

export async function getJobErosion(jobId, contractorUserId) {
  return runDailyErosionCalculation(jobId, contractorUserId);
}
