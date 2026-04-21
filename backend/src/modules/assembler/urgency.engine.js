export function calculateUrgency(jobStartTime, now = new Date(), hasGhostSignal = false) {
  const start = new Date(jobStartTime);
  const deltaMinutes = Math.floor((start - now) / (1000 * 60));

  if (hasGhostSignal || deltaMinutes <= -15) return "ghost";
  if (deltaMinutes <= 240) return "critical";
  if (deltaMinutes <= 1440) return "urgent";
  return "standard";
}

export function calculateTTL(urgency) {
  if (urgency === "critical") return 5;
  if (urgency === "urgent") return 15;
  if (urgency === "ghost") return 0;
  return 60;
}

export function getExpansionParams(urgency) {
  if (urgency === "critical") {
    return { radiusMiles: 50, allowAdjacency: true, allowGeneralLabor: true, timeoutMinutes: 5, urgencyLevel: urgency };
  }

  if (urgency === "urgent") {
    return { radiusMiles: 30, allowAdjacency: true, allowGeneralLabor: false, timeoutMinutes: 15, urgencyLevel: urgency };
  }

  if (urgency === "ghost") {
    return { radiusMiles: 50, allowAdjacency: true, allowGeneralLabor: true, timeoutMinutes: 1, urgencyLevel: urgency };
  }

  return { radiusMiles: 15, allowAdjacency: false, allowGeneralLabor: false, timeoutMinutes: 60, urgencyLevel: urgency };
}
