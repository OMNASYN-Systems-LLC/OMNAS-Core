import rules from "./config/schedulingRules.json" with { type: "json" };
import safetyExclusions from "./config/safetyExclusions.json" with { type: "json" };
import zoningRules from "./config/zoningRules.json" with { type: "json" };
import resolutionRules from "./config/resolutionRules.json" with { type: "json" };

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function toSafetyTrade(value) {
  return normalize(value).toUpperCase();
}

function findWeek(schedule, category) {
  const c = normalize(category);
  for (const week of [1, 2, 3]) {
    if ((schedule[`week${week}`] || []).some((item) => normalize(item.category) === c)) return week;
  }
  return null;
}

function toMobilityTrade(task) {
  const key = toSafetyTrade(task?.trade || task?.category || "");
  if (key.includes("ELECTR")) return "ELECTRICIAN";
  if (key.includes("PAINT")) return "PAINTER";
  if (key.includes("PLUMB")) return "PLUMBER";
  if (key.includes("HVAC")) return "HVAC";
  if (key.includes("DRYWALL")) return "DRYWALL";
  if (key.includes("CONCRETE")) return "CONCRETE";
  return key;
}

export function calculatePriorityScore(task) {
  const w = resolutionRules.priority_weights;
  const completion = Number(task?.completion || 0);
  const cp = task?.criticalPath ? 1 : 0;
  const equipment = task?.heavyEquipment ? 1 : 0;
  const completionBonus = completion > resolutionRules.completion_threshold ? 1 : 0;

  return cp * w.critical_path + equipment * w.equipment + completionBonus * w.completion_bonus;
}

export function determineAnchorAndMover(taskA, taskB) {
  const scoreA = calculatePriorityScore(taskA);
  const scoreB = calculatePriorityScore(taskB);

  if (scoreA === scoreB) {
    return { anchor: taskA, mover: taskB };
  }

  return scoreA > scoreB ? { anchor: taskA, mover: taskB } : { anchor: taskB, mover: taskA };
}

export function attemptShiftResolution(task, zone) {
  if (task.shift === "PM") return null;
  const pmAvailable = !zone?.occupiedPM;
  if (!pmAvailable) return null;

  return {
    action: "SHIFT_MOVE",
    to: { ...task, shift: "PM" },
    reason: "PM slot available in same zone",
    requiresApproval: false
  };
}

export function attemptZoneResolution(task) {
  const mobilityTrade = toMobilityTrade(task);
  const mobility = resolutionRules.trade_mobility_index[mobilityTrade] || 0;
  if (mobility <= 0.7) return null;

  const altZone = task.alternateZone || "ALT_ZONE";
  return {
    action: "ZONE_MOVE",
    to: { ...task, zone_id: altZone },
    reason: "High mobility trade allows zone reassignment",
    requiresApproval: false
  };
}

export function attemptDayResolution(task) {
  return {
    action: "DAY_MOVE",
    to: { ...task, date: task.date ? `${task.date}+1d` : "next_day" },
    reason: "Fallback day move required",
    requiresApproval: true
  };
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
    if (ratio >= point.ratio) factor = point.factor;
  }
  const warnings = [];
  if (ratio > 1.2) warnings.push(`Congested: >200 SF per worker (ratio ${ratio.toFixed(2)})`);
  return { occupancyRatio: Number(ratio.toFixed(2)), congestionFactor: factor, congestionWarnings: warnings };
}

export function applyFatigue(workerHours) {
  const hours = Number(workerHours || 0);
  if (hours > rules.fatigue.weekly_threshold) {
    return { fatigueFactor: rules.fatigue.penalty, fatigueWarnings: [`Fatigue: >${rules.fatigue.weekly_threshold} hrs/week`] };
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

export function detectTemporalOverlap(taskA, taskB) {
  const s1 = Number(taskA.startHour ?? 6);
  const e1 = Number(taskA.endHour ?? 18);
  const s2 = Number(taskB.startHour ?? 6);
  const e2 = Number(taskB.endHour ?? 18);
  return s1 <= e2 && s2 <= e1;
}

export function detectShiftOverlap(taskA, taskB) {
  return String(taskA.shift || "AM") === String(taskB.shift || "AM");
}

export function detectSpatialOverlap(taskA, taskB) {
  if ((taskA.zone_id || "SITE") !== (taskB.zone_id || "SITE")) return false;
  const zoneType = String(taskA.zone_type || taskB.zone_type || "ROOM").toUpperCase();
  if (zoneType === "ROOM") return true;
  if (zoneType === "FLOOR") {
    const zoneSqFt = Math.max(1, Number(taskA.zone_sq_ft || taskB.zone_sq_ft || 1000));
    const max = zoningRules.zone_types.FLOOR.max_occupancy_per_1000sqft * (zoneSqFt / 1000);
    return Number(taskA.crew || 1) + Number(taskB.crew || 1) > max;
  }
  if (zoneType === "RADIUS") return true;
  return true;
}

export function detectDistanceConflict(taskA, taskB) {
  const tradeA = toSafetyTrade(taskA.safetyTrade || taskA.category);
  const tradeB = toSafetyTrade(taskB.safetyTrade || taskB.category);
  const rule = (zoningRules.distance_rules || []).find((item) => {
    const t1 = toSafetyTrade(item.trades[0]);
    const t2 = toSafetyTrade(item.trades[1]);
    return (tradeA === t1 && tradeB === t2) || (tradeA === t2 && tradeB === t1);
  });
  if (!rule) return null;
  const simulatedDistance = taskA.zone_id === taskB.zone_id ? 10 : 50;
  if (simulatedDistance < Number(rule.min_distance_ft)) return { ...rule, tradeA, tradeB, simulatedDistance };
  return null;
}

export function checkSafetyConflicts(schedule, zones = {}) {
  const safetyConflicts = [];
  const spatialConflicts = [];
  const temporalConflicts = [];
  const zoneAnalysis = [];

  for (const week of [1, 2, 3]) {
    const key = `week${week}`;
    const entries = (schedule[key] || []).map((entry) => {
      const zoneMeta = zones[entry.category] || {};
      return {
        ...entry,
        taskId: entry.taskId || `${normalize(entry.category)}-${key}`,
        zone_id: entry.zone_id || zoneMeta.zone_id || "SITE",
        zone_type: entry.zone_type || zoneMeta.zone_type || "ROOM",
        zone_sq_ft: entry.zone_sq_ft || zoneMeta.zone_sq_ft || 400,
        shift: entry.shift || zoneMeta.shift || "AM",
        startHour: entry.startHour ?? zoneMeta.startHour ?? 6,
        endHour: entry.endHour ?? zoneMeta.endHour ?? 18,
        crew: entry.crew || zoneMeta.crew || 1
      };
    });

    const perZone = new Map();

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        const sameShift = detectShiftOverlap(a, b);
        const timeOverlap = detectTemporalOverlap(a, b);
        const spatialOverlap = detectSpatialOverlap(a, b);

        if (timeOverlap && sameShift) temporalConflicts.push({ taskAId: a.taskId, taskBId: b.taskId, tradeA: a.category, tradeB: b.category, zone: a.zone_id, time: `week${week}-${a.shift}` });
        if (spatialOverlap) spatialConflicts.push({ taskAId: a.taskId, taskBId: b.taskId, tradeA: a.category, tradeB: b.category, zone: a.zone_id, time: `week${week}-${a.shift}` });

        if (!timeOverlap || !sameShift || !spatialOverlap) continue;
        const distRule = detectDistanceConflict(a, b);
        if (!distRule) continue;

        const severity = distRule.severity;
        const action = safetyExclusions.severity?.[severity]?.action || "ADVISE";
        safetyConflicts.push({
          taskAId: a.taskId,
          taskBId: b.taskId,
          tradeA: distRule.tradeA,
          tradeB: distRule.tradeB,
          severity,
          action,
          zone: a.zone_id,
          time: `${a.shift} week${week}`,
          message: `Distance Risk: ${distRule.tradeA} requires ${distRule.min_distance_ft}ft separation`
        });
      }

      const zoneKey = `${entries[i].zone_id}-${week}`;
      perZone.set(zoneKey, (perZone.get(zoneKey) || 0) + Number(entries[i].crew || 1));
    }

    for (const [zoneWeek, occupancy] of perZone.entries()) {
      zoneAnalysis.push({
        zone: zoneWeek,
        occupancy,
        conflicts: safetyConflicts.filter((item) => item.zone && zoneWeek.startsWith(item.zone)).length,
        warnings: occupancy > zoningRules.zone_types.ROOM.max_occupancy ? ["Occupancy above room threshold"] : []
      });
    }
  }

  return {
    safetyConflicts,
    spatialConflicts,
    temporalConflicts,
    zoneAnalysis,
    hasCritical: safetyConflicts.some((item) => item.severity === "CRITICAL")
  };
}
