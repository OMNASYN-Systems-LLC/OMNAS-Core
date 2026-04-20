import productionRates from "../../config/productionRates.json" with { type: "json" };
import {
  applyCongestion,
  applyFatigue,
  checkDependencies,
  checkSafetyConflicts,
  computeEffectiveProductivity,
  getMaxCrewThreshold
} from "./rulesEngine.js";

const DEFAULT_REQUIRED_WORK = {
  drywall: 1800,
  electrical: 720,
  concrete: 22,
  roofing: 20,
  sitework: 80,
  plumbing: 64,
  hvac: 56,
  finishes: 160,
  maintenance: 40,
  default: 80
};

function normalizeCategory(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cloneWeekEntries(entries = []) {
  return entries.map((item) => ({ ...item }));
}

function removeCategoryFromWeeks(weeks, category) {
  for (const key of ["week1", "week2", "week3"]) {
    weeks[key] = weeks[key].filter((entry) => entry.category !== category);
  }
}

function addToWeek(weeks, weekNumber, entry) {
  const safeWeek = Math.max(1, Math.min(3, weekNumber));
  const key = `week${safeWeek}`;
  if (!weeks[key].some((item) => item.category === entry.category)) {
    weeks[key].push(entry);
  }
}

function findWeekForCategory(weeks, category) {
  for (const week of [1, 2, 3]) {
    if (weeks[`week${week}`].some((entry) => entry.category === category)) {
      return week;
    }
  }

  return null;
}

function parseWeatherInfo(weatherSource) {
  const text = String(weatherSource || "").toLowerCase();
  return {
    lightRain: text.includes("light rain"),
    moderateRain: text.includes("moderate rain"),
    heavyRain: text.includes("heavy rain"),
    wind: text.includes("wind"),
    heat95: text.includes("95") || text.includes("heat"),
    heat105: text.includes("105")
  };
}

function getWeatherMultiplierForTrade(category, weatherSource) {
  const c = normalizeCategory(category);
  const weather = parseWeatherInfo(weatherSource);

  let multiplier = 1;

  if (weather.lightRain) multiplier = Math.min(multiplier, 0.85);
  if (weather.moderateRain) multiplier = Math.min(multiplier, 0.4);
  if (weather.heavyRain) multiplier = Math.min(multiplier, 0.0);

  if (weather.heat95) multiplier = Math.min(multiplier, 0.75);
  if (weather.heat105) multiplier = Math.min(multiplier, 0.4);

  if (weather.wind && ["roofing", "crane", "material"].includes(c)) {
    multiplier = 0;
  }

  return multiplier;
}

function getRatePerWorkerHour(category) {
  const normalized = normalizeCategory(category);
  return productionRates[normalized]?.rate_per_worker_hr || 1;
}

function getRequiredWork(category) {
  const normalized = normalizeCategory(category);
  return DEFAULT_REQUIRED_WORK[normalized] || DEFAULT_REQUIRED_WORK.default;
}

function getWorkerStats(assignments, logs, category) {
  const normalized = normalizeCategory(category);
  const workers = assignments.filter((assignment) => {
    const trade = normalizeCategory(assignment.trade_primary);
    return trade === normalized || trade.includes(normalized) || normalized.includes(trade);
  });

  const workerIds = new Set(workers.map((item) => item.worker_user_id));
  let weeklyHours = 0;
  for (const log of logs || []) {
    if (workerIds.has(log.worker_user_id)) {
      weeklyHours += Number(log.hours_worked || 0);
    }
  }

  return {
    workerCount: Math.max(1, workers.length),
    weeklyHours,
    crewSize: Math.max(1, workers.length)
  };
}

function capacityRebalance(weeks, adjustments, maxPerWeek = 3) {
  for (const week of [1, 2]) {
    const key = `week${week}`;
    while (weeks[key].length > maxPerWeek) {
      const shifted = weeks[key].pop();
      addToWeek(weeks, week + 1, shifted);
      adjustments.push({ category: shifted.category, action: "DELAYED", reason: "capacity_rebalance" });
    }
  }
}

export function adjustLookahead({ audit, lookahead, assignments, recommendations, weatherSource, logs = [], jobMeta = {} }) {
  const originalLookahead = {
    week1: cloneWeekEntries(lookahead?.week1),
    week2: cloneWeekEntries(lookahead?.week2),
    week3: cloneWeekEntries(lookahead?.week3)
  };

  const adjusted = {
    week1: cloneWeekEntries(lookahead?.week1),
    week2: cloneWeekEntries(lookahead?.week2),
    week3: cloneWeekEntries(lookahead?.week3)
  };

  const safetyCheck = checkSafetyConflicts(adjusted, jobMeta.zones || {});

  const adjustments = [];
  const congestionWarnings = [];
  const fatigueWarnings = [];
  const recMap = new Map((recommendations?.gapRecommendations || []).map((gap) => [gap.category, gap.topRecommendations?.[0] || null]));

  const productivityFactors = [];

  const capacityAnalysis = (audit?.categoryAudits || []).map((auditItem) => {
    const stats = getWorkerStats(assignments || [], logs, auditItem.category);
    const baseRate = getRatePerWorkerHour(auditItem.category);
    const weatherMultiplier = getWeatherMultiplierForTrade(auditItem.category, weatherSource || audit?.weatherImpact?.source);

    const zoneSqFt = Number(jobMeta.zoneSqFt || jobMeta.siteSqFt || 2000);
    const congestion = applyCongestion({
      totalWorkers: stats.workerCount,
      zoneSqFt
    });

    const fatigue = applyFatigue(stats.weeklyHours);

    const maxCrew = getMaxCrewThreshold(auditItem.category);
    let crewPenalty = 1;
    if (stats.crewSize > maxCrew) {
      crewPenalty = 0.8;
      congestionWarnings.push({ category: auditItem.category, message: "CREW_OVERSTACK" });
    }

    const effectiveProductivity = computeEffectiveProductivity(
      baseRate,
      weatherMultiplier,
      congestion.congestionFactor * crewPenalty,
      fatigue.fatigueFactor
    );

    const capacity = Number((stats.workerCount * effectiveProductivity * 8).toFixed(2));
    const requiredWork = getRequiredWork(auditItem.category);
    const adjustedDuration = capacity <= 0 ? 5 : Math.max(1, Math.ceil(requiredWork / capacity));

    congestionWarnings.push(...congestion.congestionWarnings.map((message) => ({ category: auditItem.category, message })));
    fatigueWarnings.push(...fatigue.fatigueWarnings.map((message) => ({ category: auditItem.category, message: `${message} (OVERTIME_FATIGUE)` })));

    productivityFactors.push({
      category: auditItem.category,
      crewSize: stats.crewSize,
      occupancyRatio: congestion.occupancyRatio,
      congestionFactor: Number((congestion.congestionFactor * crewPenalty).toFixed(2)),
      fatigueFactor: fatigue.fatigueFactor,
      effectiveProductivity
    });

    return {
      category: auditItem.category,
      workers: stats.workerCount,
      capacity,
      requiredWork,
      weatherMultiplier,
      adjustedDuration
    };
  });

  const dependencyResult = checkDependencies(adjusted, audit?.categoryAudits || []);
  const dependencyWarnings = dependencyResult.dependencyWarnings;
  const blockedCategories = dependencyResult.blockedCategories;

  if (safetyCheck.hasCritical) {
    return {
      originalLookahead,
      adjustedLookahead: originalLookahead,
      adjustments: [],
      capacityAnalysis: [],
      dependencyWarnings: [],
      congestionWarnings: [],
      fatigueWarnings: [],
      productivityFactors: [],
      safetyConflicts: safetyCheck.safetyConflicts,
      blocked: true,
      error: `Cannot schedule ${safetyCheck.safetyConflicts[0].tradeA} and ${safetyCheck.safetyConflicts[0].tradeB} in same zone.`
    };
  }

  const capacityMap = new Map(capacityAnalysis.map((item) => [item.category, item]));

  for (const auditItem of audit?.categoryAudits || []) {
    const currentWeek = findWeekForCategory(adjusted, auditItem.category) || auditItem.plannedWeek || 1;
    const cap = capacityMap.get(auditItem.category);

    if (blockedCategories.has(normalizeCategory(auditItem.category))) {
      removeCategoryFromWeeks(adjusted, auditItem.category);
      addToWeek(adjusted, Math.min(3, currentWeek + 1), { category: auditItem.category, source: "dependency_blocked" });
      adjustments.push({ category: auditItem.category, action: "DELAYED", reason: "hard_dependency_blocked" });
      continue;
    }

    if (auditItem.status === "RED") {
      removeCategoryFromWeeks(adjusted, auditItem.category);
      const durationWeeks = cap ? Math.max(1, Math.ceil(cap.adjustedDuration / 5)) : 1;
      addToWeek(adjusted, currentWeek + durationWeeks, { category: auditItem.category, source: "resequenced", priority: "high" });
      adjustments.push({ category: auditItem.category, action: "MOVED", reason: "red_status_duration_extension" });
    }

    if ((auditItem.flags || []).includes("MISSING") || (auditItem.flags || []).includes("MISSING_WORK")) {
      const rec = recMap.get(auditItem.category);
      removeCategoryFromWeeks(adjusted, auditItem.category);
      addToWeek(adjusted, 1, {
        category: auditItem.category,
        source: "missing_priority",
        recommendedWorkerId: rec?.workerId || null,
        recommendedWorkerName: rec?.workerName || null,
        priority: "urgent"
      });
      adjustments.push({ category: auditItem.category, action: "MOVED", reason: "missing_work_priority_week1" });
    }

    if ((auditItem.flags || []).includes("EARLY") && cap && cap.capacity >= cap.requiredWork) {
      const nextWeek = Math.min(3, currentWeek + 1);
      const nextCandidate = adjusted[`week${nextWeek}`][0];
      if (nextCandidate) {
        removeCategoryFromWeeks(adjusted, nextCandidate.category);
        addToWeek(adjusted, currentWeek, { ...nextCandidate, source: "pulled_forward" });
        adjustments.push({ category: nextCandidate.category, action: "PULLED_FORWARD", reason: "early_completion_capacity_available" });
      }
    }

    if (cap && cap.weatherMultiplier < 1 && currentWeek < 3) {
      removeCategoryFromWeeks(adjusted, auditItem.category);
      addToWeek(adjusted, currentWeek + 1, { category: auditItem.category, source: "weather_preadjust", weatherMultiplier: cap.weatherMultiplier });
      adjustments.push({ category: auditItem.category, action: "DELAYED", reason: "weather_preadjust_next_week" });
    }
  }

  capacityRebalance(adjusted, adjustments, 3);

  return {
    originalLookahead,
    adjustedLookahead: adjusted,
    adjustments,
    capacityAnalysis,
    dependencyWarnings,
    congestionWarnings,
    fatigueWarnings,
    productivityFactors,
    safetyConflicts: safetyCheck.safetyConflicts,
    blocked: false
  };
}
