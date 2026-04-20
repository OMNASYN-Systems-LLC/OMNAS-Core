import rules from "./config/schedulingRules.json" with { type: "json" };
import safetyExclusions from "./config/safetyExclusions.json" with { type: "json" };

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toSafetyTrade(value) {
  return normalize(value).toUpperCase();
}

function findWeek(schedule, category) {
  const c = normalize(category);
  for (const week of [1, 2, 3]) {
    if ((schedule[`week${week}`] || []).some((item) => normalize(item.category) === c)) {
      return week;
    }
  }
  return null;
}

export function checkDependencies(schedule, tasks) {
  const completion = new Map((tasks || []).map((t) => [normalize(t.category), Number(t.actualProgress || 0)]));
  const dependencyWarnings = [];
  const blockedCategories = new Set();

  for (const dep of rules.dependencies.hard || []) {
    const pred = normalize(dep.predecessor);
    const succ = normalize(dep.successor);
    const predComplete = (completion.get(pred) || 0) >= 100;
    const predWeek = findWeek(schedule, pred);
    const succWeek = findWeek(schedule, succ);

    if (!predComplete && succWeek !== null && (predWeek === null || succWeek <= predWeek)) {
      blockedCategories.add(succ);
      dependencyWarnings.push({ category: succ, type: "hard", message: `Blocked: ${dep.reason}` });
    }
  }

  for (const dep of rules.dependencies.soft || []) {
    const pred = normalize(dep.predecessor);
    const succ = normalize(dep.successor);
    const predWeek = findWeek(schedule, pred);
    const succWeek = findWeek(schedule, succ);

    if (predWeek !== null && succWeek !== null && succWeek < predWeek) {
      dependencyWarnings.push({ category: succ, type: "soft", message: `Risk: ${dep.reason}` });
    }
  }

  return { dependencyWarnings, blockedCategories };
}

export function applyCongestion(zoneData) {
  const totalWorkers = Number(zoneData.totalWorkers || 0);
  const zoneSqFt = Math.max(1, Number(zoneData.zoneSqFt || 2000));
  const ratio = (totalWorkers * rules.congestion.sq_ft_per_worker) / zoneSqFt;

  let factor = 1;
  for (const point of rules.congestion.decay_curve || []) {
    if (ratio >= point.ratio) {
      factor = point.factor;
    }
  }

  const warnings = [];
  if (ratio > 1.2) {
    warnings.push(`Congested: >200 SF per worker (ratio ${ratio.toFixed(2)})`);
  }

  return { occupancyRatio: Number(ratio.toFixed(2)), congestionFactor: factor, congestionWarnings: warnings };
}

export function applyFatigue(workerHours) {
  const hours = Number(workerHours || 0);
  if (hours > rules.fatigue.weekly_threshold) {
    return {
      fatigueFactor: rules.fatigue.penalty,
      fatigueWarnings: [`Fatigue: >${rules.fatigue.weekly_threshold} hrs/week`]
    };
  }

  return { fatigueFactor: 1, fatigueWarnings: [] };
}

export function computeEffectiveProductivity(baseRate, weatherMultiplier, congestionFactor, fatigueFactor) {
  return Number((baseRate * weatherMultiplier * congestionFactor * fatigueFactor).toFixed(4));
}

export function getMaxCrewThreshold(category) {
  const c = normalize(category);
  return rules.congestion.max_crews[c] || rules.congestion.max_crews.default || 5;
}

export function checkSafetyConflicts(schedule, zones = {}) {
  const safetyConflicts = [];

  for (const week of [1, 2, 3]) {
    const key = `week${week}`;
    const entries = schedule[key] || [];

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];

        const zoneA = a.zone || zones[a.category] || "SITE";
        const zoneB = b.zone || zones[b.category] || "SITE";
        if (zoneA !== zoneB) {
          continue;
        }

        const tradeA = toSafetyTrade(a.safetyTrade || a.category);
        const tradeB = toSafetyTrade(b.safetyTrade || b.category);

        const match = (safetyExclusions.conflicts || []).find((rule) => {
          const t1 = toSafetyTrade(rule.trades[0]);
          const t2 = toSafetyTrade(rule.trades[1]);
          return (tradeA === t1 && tradeB === t2) || (tradeA === t2 && tradeB === t1);
        });

        if (!match) {
          continue;
        }

        const severity = match.severity;
        const action = safetyExclusions.severity?.[severity]?.action || "ADVISE";

        safetyConflicts.push({
          tradeA,
          tradeB,
          severity,
          action,
          zone: zoneA,
          time: `week${week}`
        });
      }
    }
  }

  return {
    safetyConflicts,
    hasCritical: safetyConflicts.some((item) => item.severity === "CRITICAL")
  };
}
