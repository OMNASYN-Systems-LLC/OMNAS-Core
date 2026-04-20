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
    weeks[key].unshift(entry);
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

export function adjustLookahead({ audit, lookahead, assignments, recommendations }) {
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

  for (const auditItem of audit?.categoryAudits || []) {
    const currentWeek = findWeekForCategory(adjusted, auditItem.category) || auditItem.plannedWeek || 1;

    if (auditItem.status === "RED") {
      removeCategoryFromWeeks(adjusted, auditItem.category);
      addToWeek(adjusted, currentWeek + 1, { category: auditItem.category, source: "resequenced", priority: "high" });
      adjustments.push({ category: auditItem.category, action: "MOVED", reason: "red_status_delay" });
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

    if ((auditItem.flags || []).includes("EARLY")) {
      const nextWeek = Math.min(3, currentWeek + 1);
      const nextCandidate = adjusted[`week${nextWeek}`][0];
      if (nextCandidate) {
        removeCategoryFromWeeks(adjusted, nextCandidate.category);
        addToWeek(adjusted, currentWeek, { ...nextCandidate, source: "pulled_forward" });
        adjustments.push({ category: nextCandidate.category, action: "PULLED_FORWARD", reason: "early_completion_pull_forward" });
      }
    }
  }

  const weatherImpacts = audit?.weatherImpact?.affectedCategories || [];
  for (const impacted of weatherImpacts) {
    const currentWeek = findWeekForCategory(adjusted, impacted.category);
    if (!currentWeek) {
      continue;
    }

    removeCategoryFromWeeks(adjusted, impacted.category);
    addToWeek(adjusted, currentWeek + 1, { category: impacted.category, source: "weather_carryover", weatherMultiplier: impacted.weatherMultiplier });
    adjustments.push({ category: impacted.category, action: "DELAYED", reason: "weather_carryover_1day_equivalent" });
  }

  capacityRebalance(adjusted, adjustments, 3);

  return {
    originalLookahead,
    adjustedLookahead: adjusted,
    adjustments,
    context: {
      assignmentCount: assignments?.length || 0
    }
  };
}
