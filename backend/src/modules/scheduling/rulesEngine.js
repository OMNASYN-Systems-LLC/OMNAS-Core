import rules from "./config/schedulingRules.json" with { type: "json" };
import safetyExclusions from "./config/safetyExclusions.json" with { type: "json" };
import zoningRules from "./config/zoningRules.json" with { type: "json" };
import resolutionRules from "./config/resolutionRules.json" with { type: "json" };
import escalationRules from "./config/escalationRules.json" with { type: "json" };

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDustyTrade(task) {
  const trade = toSafetyTrade(task?.safetyTrade || task?.trade || task?.category || "");
  return (escalationRules.finish_protection?.restricted_trades || []).some((entry) => trade.includes(toSafetyTrade(entry)));
}

export function checkHardLock(taskA, taskB) {
  const distRule = detectDistanceConflict(taskA, taskB);
  if (!distRule) return { blocked: false, ruleTriggered: null, reason: null };

  if (distRule.severity === "CRITICAL") {
    return {
      blocked: true,
      ruleTriggered: "critical_distance_exclusion",
      reason: `Critical separation breach for ${distRule.tradeA}/${distRule.tradeB}`
    };
  }

  return { blocked: false, ruleTriggered: null, reason: null };
}

export function checkEscalationConditions(taskA, taskB, zone = {}) {
  const thresholdA = escalationRules.near_critical_path?.float_consumption_threshold ?? 0.75;
  const minFloat = escalationRules.near_critical_path?.min_float_remaining_days ?? 2;
  const floatA = toNumber(taskA?.floatDays ?? taskA?.float_days, 0);
  const floatB = toNumber(taskB?.floatDays ?? taskB?.float_days, 0);
  const delayA = toNumber(taskA?.delayDays ?? taskA?.delay_days, 0);
  const delayB = toNumber(taskB?.delayDays ?? taskB?.delay_days, 0);

  if ((floatA > 0 && delayA > floatA * thresholdA) || (floatB > 0 && delayB > floatB * thresholdA) || (floatA > 0 && floatA <= minFloat) || (floatB > 0 && floatB <= minFloat)) {
    return {
      escalated: true,
      ruleTriggered: "near_critical_path",
      reason: "Float erosion near critical path threshold",
      suggestedAction: "Superintendent review sequencing and recovery options"
    };
  }

  const zoneSqFt = Math.max(1, toNumber(zone?.zone_sq_ft ?? zone?.sqFt ?? taskA?.zone_sq_ft ?? taskB?.zone_sq_ft, 400));
  const workers = Math.max(1, toNumber(zone?.worker_count, toNumber(taskA?.crew, 1) + toNumber(taskB?.crew, 1)));
  const ladderRequired = Boolean(taskA?.ladder_required || taskB?.ladder_required);
  if (ladderRequired && zoneSqFt / workers < escalationRules.spatial_complexity?.min_sqft_per_worker) {
    return {
      escalated: true,
      ruleTriggered: "spatial_complexity",
      reason: "High ladder density in constrained workspace",
      suggestedAction: "Manually stagger ladder trades and reduce concurrent headcount"
    };
  }

  if (escalationRules.asset_overlap?.enable_swing_radius_check) {
    const radiusA = toNumber(taskA?.swingRadiusFt ?? taskA?.radius_ft, 0);
    const radiusB = toNumber(taskB?.swingRadiusFt ?? taskB?.radius_ft, 0);
    const distanceBetween = toNumber(zone?.distance_between ?? taskA?.distance_between ?? taskB?.distance_between, taskA?.zone_id === taskB?.zone_id ? 10 : 50);
    if (radiusA + radiusB > distanceBetween) {
      return {
        escalated: true,
        ruleTriggered: "asset_overlap",
        reason: "Equipment swing envelopes overlap",
        suggestedAction: "Assign dedicated time windows for heavy equipment movement"
      };
    }
  }

  const finishStatus = toNumber(zone?.finish_status ?? zone?.finishStatus ?? taskA?.finish_status ?? taskB?.finish_status, 0);
  const finishThreshold = escalationRules.finish_protection?.threshold ?? 0.85;
  if (finishStatus > finishThreshold && (isDustyTrade(taskA) || isDustyTrade(taskB))) {
    return {
      escalated: true,
      ruleTriggered: "finish_protection",
      reason: "Dusty trade entering protected finish zone",
      suggestedAction: "Require protection plan and superintendent approval before proceeding"
    };
  }

  return { escalated: false, ruleTriggered: null, reason: null, suggestedAction: null };
}

export function resolveConflict(taskA, taskB, zone = {}) {
  const { anchor, mover } = determineAnchorAndMover(taskA, taskB);
  const shift = attemptShiftResolution(mover, zone);
  if (shift) return { anchor, mover, resolution: shift };

  const zoneMove = attemptZoneResolution(mover);
  if (zoneMove) return { anchor, mover, resolution: zoneMove };

  return { anchor, mover, resolution: attemptDayResolution(mover) };
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
  const conflictsDetected = [];
  const autoResolutions = [];
  const manualOverridesRequired = [];
  const escalations = [];

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

        const zoneMeta = zones[a.zone_id] || zones[a.category] || zones.default || {};
        const conflict = {
          taskAId: a.taskId,
          taskBId: b.taskId,
          tradeA: a.category,
          tradeB: b.category,
          zone: a.zone_id,
          time: `${a.shift} week${week}`
        };

        conflictsDetected.push(conflict);

        const hardLock = checkHardLock(a, b);
        if (hardLock.blocked) {
          safetyConflicts.push({
            ...conflict,
            severity: "CRITICAL",
            action: "BLOCK",
            message: hardLock.reason
          });
          manualOverridesRequired.push({
            ...conflict,
            reason: hardLock.reason,
            ruleTriggered: hardLock.ruleTriggered,
            severity: "RED",
            suggestedAction: "Manual superintendent override required"
          });
          continue;
        }

        const escalation = checkEscalationConditions(a, b, zoneMeta);
        if (escalation.escalated) {
          escalations.push({
            taskId: a.taskId,
            zone: a.zone_id,
            reason: escalation.reason,
            ruleTriggered: escalation.ruleTriggered,
            severity: "AMBER",
            suggestedAction: escalation.suggestedAction
          });
          escalations.push({
            taskId: b.taskId,
            zone: b.zone_id,
            reason: escalation.reason,
            ruleTriggered: escalation.ruleTriggered,
            severity: "AMBER",
            suggestedAction: escalation.suggestedAction
          });
          manualOverridesRequired.push({
            ...conflict,
            reason: escalation.reason,
            ruleTriggered: escalation.ruleTriggered,
            severity: "AMBER",
            suggestedAction: escalation.suggestedAction
          });
          continue;
        }

        const distRule = detectDistanceConflict(a, b);
        if (distRule) {
          const severity = distRule.severity;
          const action = safetyExclusions.severity?.[severity]?.action || "ADVISE";
          safetyConflicts.push({
            ...conflict,
            tradeA: distRule.tradeA,
            tradeB: distRule.tradeB,
            severity,
            action,
            message: `Distance Risk: ${distRule.tradeA} requires ${distRule.min_distance_ft}ft separation`
          });
        }

        const resolution = resolveConflict(a, b, zoneMeta);
        if (resolution?.resolution?.requiresApproval) {
          manualOverridesRequired.push({
            ...conflict,
            reason: resolution.resolution.reason,
            ruleTriggered: resolution.resolution.action,
            severity: "AMBER",
            suggestedAction: "Review proposed date move before execution"
          });
        } else {
          autoResolutions.push({
            ...conflict,
            taskId: resolution.mover.taskId,
            reason: resolution.resolution.reason,
            ruleTriggered: resolution.resolution.action,
            severity: "GREEN",
            suggestedAction: "Applied automatically",
            to: resolution.resolution.to
          });
        }
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
    conflictsDetected,
    autoResolutions,
    manualOverridesRequired,
    escalations,
    safetyConflicts,
    spatialConflicts,
    temporalConflicts,
    zoneAnalysis,
    hasCritical: safetyConflicts.some((item) => item.severity === "CRITICAL")
  };
}
