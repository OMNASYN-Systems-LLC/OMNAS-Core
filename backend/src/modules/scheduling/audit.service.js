import { normalizeTrade } from "../pca/taxonomy/tradeIntelligence.js";

const TRADE_RATES = {
  sitework: 1.0,
  concrete: 0.85,
  roofing: 0.9,
  electrical: 1.1,
  plumbing: 1.0,
  hvac: 0.95,
  finishes: 1.05,
  maintenance: 1.0,
  default: 1.0
};

const WEATHER_MULTIPLIERS = {
  sitework: { rain: 0.2, heat: 0.8, wind: 0.9 },
  concrete: { rain: 0.0, heat: 0.7, wind: 0.9 },
  roofing: { rain: 0.0, wind: 0.0, heat: 0.85 },
  electrical: { rain: 0.9, heat: 0.95, wind: 1.0 },
  plumbing: { rain: 0.8, heat: 0.9, wind: 0.95 },
  hvac: { rain: 0.85, heat: 0.9, wind: 0.9 },
  finishes: { rain: 0.95, heat: 0.95, wind: 1.0 },
  maintenance: { rain: 0.9, heat: 0.9, wind: 0.95 }
};

const TOTAL_EXPECTED_WORK = 200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inferPlannedItems(lookahead) {
  const items = [];

  for (const week of [1, 2, 3]) {
    const key = `week${week}`;
    for (const entry of lookahead?.[key] || []) {
      items.push({ category: normalizeTrade(entry.category), plannedWeek: week });
    }
  }

  return items;
}

function parseWeatherTokens(weatherText) {
  const text = String(weatherText || "").toLowerCase();
  return {
    rain: text.includes("rain"),
    heat: text.includes("heat"),
    wind: text.includes("wind")
  };
}

function getWeatherEffect(weatherText, category) {
  const normalizedCategory = normalizeTrade(category);
  const weather = parseWeatherTokens(weatherText);
  const categoryMultipliers = WEATHER_MULTIPLIERS[normalizedCategory] || {};

  let multiplier = 1;
  const reasons = [];

  for (const [condition, present] of Object.entries(weather)) {
    if (!present) {
      continue;
    }

    const weatherMultiplier = categoryMultipliers[condition] ?? 1;
    multiplier = Math.min(multiplier, weatherMultiplier);
    if (weatherMultiplier < 1) {
      reasons.push(`${condition}:${weatherMultiplier}`);
    }
  }

  return {
    multiplier,
    blocked: multiplier === 0,
    reason: reasons.join(",") || null
  };
}

function detectLogCategory(log, category) {
  const normalizedCategory = normalizeTrade(category);
  const detectedCategories = Array.isArray(log.detected_categories) ? log.detected_categories.map(normalizeTrade) : [];
  const assignedCategory = normalizeTrade(log.assigned_category);
  const text = `${log.work_completed || ""} ${log.work_summary || ""}`.toLowerCase();

  return detectedCategories.includes(normalizedCategory) || assignedCategory === normalizedCategory || text.includes(normalizedCategory.replace(/_/g, " "));
}

function summarizeStatus(categoryAudits) {
  if (categoryAudits.some((item) => item.status === "RED")) {
    return "RED";
  }

  if (categoryAudits.some((item) => item.status === "YELLOW")) {
    return "YELLOW";
  }

  return "GREEN";
}

function computeBaseExpectedProgress(plannedWeek, baselineDate) {
  const weekStart = new Date(baselineDate);
  weekStart.setDate(weekStart.getDate() + (plannedWeek - 1) * 7);

  const now = new Date();

  if (now < weekStart) {
    return 0;
  }

  const daysElapsed = clamp(Math.floor((now - weekStart) / (1000 * 60 * 60 * 24)) + 1, 0, 5);
  return clamp(daysElapsed * 20, 0, 100);
}

function computeActualProgress(logsForCategory, category) {
  if (logsForCategory.length === 0) {
    return 0;
  }

  const tradeRate = TRADE_RATES[normalizeTrade(category)] || TRADE_RATES.default;

  const workUnits = logsForCategory.reduce((sum, log) => {
    const crew = Number(log.crew_size || 1);
    const hours = Number(log.hours_worked || 0);
    return sum + crew * hours * tradeRate;
  }, 0);

  return clamp((workUnits / TOTAL_EXPECTED_WORK) * 100, 0, 100);
}


function buildFatigueWarnings(logs) {
  const byWorker = new Map();
  for (const log of logs || []) {
    const key = log.worker_user_id || "unknown";
    byWorker.set(key, (byWorker.get(key) || 0) + Number(log.hours_worked || 0));
  }

  const warnings = [];
  for (const [workerId, hours] of byWorker.entries()) {
    if (hours > 50) {
      warnings.push({ workerId, message: "Fatigue: >50 hrs/week (OVERTIME_FATIGUE)" });
    }
  }
  return warnings;
}

export function runFieldToPlanAudit({ jobId, schedule, logs, assignments, pcaCategories, weatherInput }) {
  const plannedItems = inferPlannedItems(schedule.lookahead);
  const baselineDate = schedule?.jobStartsAt || new Date().toISOString();

  const categoryAudits = plannedItems.map((planned) => {
    const weatherSource = weatherInput || logs.find((log) => log.weather)?.weather || null;
    const weatherEffect = getWeatherEffect(weatherSource, planned.category);
    const categoryLogs = logs.filter((log) => detectLogCategory(log, planned.category));
    const hasAssignment = assignments.some((assignment) => {
      const trade = normalizeTrade(assignment.trade_primary);
      return trade === planned.category || String(assignment.job_title || "").toLowerCase().includes(planned.category.replace(/_/g, " "));
    });

    const expectedProgress = computeBaseExpectedProgress(planned.plannedWeek, baselineDate);
    const adjustedExpectedProgress = clamp(expectedProgress * weatherEffect.multiplier, 0, 100);
    const actualProgress = weatherEffect.blocked ? 0 : computeActualProgress(categoryLogs, planned.category);
    const variance = Number((actualProgress - adjustedExpectedProgress).toFixed(2));

    const flags = [];
    let status = "GREEN";

    if (!hasAssignment || categoryLogs.length === 0) {
      status = "RED";
      flags.push("MISSING_WORK", "MISSING");
    } else if (variance < -10) {
      status = "RED";
      flags.push("DELAY");
    } else if (variance >= -10 && variance <= -6) {
      status = "YELLOW";
      flags.push("DELAY");
    } else if (variance > 15) {
      status = "YELLOW";
      flags.push("QUALITY_RISK", "EARLY");
    } else if (Math.abs(variance) <= 5) {
      status = "GREEN";
    }

    if (weatherEffect.blocked) {
      status = "RED";
      flags.push("WEATHER_BLOCK");
    }

    return {
      category: planned.category,
      plannedWeek: planned.plannedWeek,
      expectedProgress,
      adjustedExpectedProgress,
      actualProgress,
      variance,
      status,
      flags: [...new Set(flags)],
      weatherMultiplier: weatherEffect.multiplier,
      logsUsed: categoryLogs.map((log) => log.id),
      explanation: `Expected ${expectedProgress}% (adjusted ${adjustedExpectedProgress}%) vs actual ${actualProgress}% (variance ${variance}%).`
    };
  });

  const productivityFactors = categoryAudits.map((item) => ({
    category: item.category,
    crewSize: logs.filter((log) => detectLogCategory(log, item.category)).reduce((sum, log) => sum + Number(log.crew_size || 1), 0),
    occupancyRatio: null,
    congestionFactor: null,
    fatigueFactor: 1,
    effectiveProductivity: Number((item.adjustedExpectedProgress / 100).toFixed(2))
  }));

  const fatigueWarnings = buildFatigueWarnings(logs);

  const weatherImpact = {
    source: weatherInput || logs.find((log) => log.weather)?.weather || null,
    affectedCategories: categoryAudits
      .filter((item) => item.weatherMultiplier < 1)
      .map((item) => ({ category: item.category, weatherMultiplier: item.weatherMultiplier }))
  };

  return {
    jobId,
    auditSummary: {
      status: summarizeStatus(categoryAudits)
    },
    categoryAudits,
    weatherImpact,
    fatigueWarnings,
    dependencyWarnings: [],
    congestionWarnings: [],
    productivityFactors,
    pcaCategories: pcaCategories.map((item) => item.category)
  };
}
