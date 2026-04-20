import productionRates from "../../config/productionRates.json" with { type: "json" };

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

function getWorkerCount(assignments, category) {
  const normalized = normalizeCategory(category);

  const count = assignments.filter((assignment) => {
    const trade = normalizeCategory(assignment.trade_primary);
    return trade === normalized || trade.includes(normalized) || normalized.includes(trade);
  }).length;

  return Math.max(1, count);
}

function capacityRebalance(weeks, adjustments, maxPerWeek = 3) {
  for (const week of [1, 2]) {
    const key = `week${week}`;
    while (weeks[key].length > maxPerWeek) {
      const shifted = weeks[key].pop();
      addToWeek(weeks, week + 1, shifted);
      adjustments.push({
        category: shifted.category,
        action: "DELAYED",
        reason: "capacity_rebalance"
      });
    }
  }
}

export function adjustLookahead({ audit, lookahead, assignments, recommendations, weatherSource }) {
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

  const adjustments = [];
  const recMap = new Map((recommendations?.gapRecommendations || []).map((gap) => [gap.category, gap.topRecommendations?.[0] || null]));

  const capacityAnalysis = (audit?.categoryAudits || []).map((auditItem) => {
    const workers = getWorkerCount(assignments || [], auditItem.category);
    const rate = getRatePerWorkerHour(auditItem.category);
    const weatherMultiplier = getWeatherMultiplierForTrade(auditItem.category, weatherSource || audit?.weatherImpact?.source);
    const capacity = Number((workers * rate * 8 * weatherMultiplier).toFixed(2));
    const requiredWork = getRequiredWork(auditItem.category);
    const adjustedDuration = capacity <= 0 ? 5 : Math.max(1, Math.ceil(requiredWork / capacity));

    return {
      category: auditItem.category,
      workers,
      capacity,
      requiredWork,
      weatherMultiplier,
      adjustedDuration
    };
  });

  const capacityMap = new Map(capacityAnalysis.map((item) => [item.category, item]));

  for (const auditItem of audit?.categoryAudits || []) {
    const currentWeek = findWeekForCategory(adjusted, auditItem.category) || auditItem.plannedWeek || 1;
    const cap = capacityMap.get(auditItem.category);

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
    capacityAnalysis
  };
}
