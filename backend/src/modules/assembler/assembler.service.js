import { createAssignmentOffer } from "../assignments/service.js";
import { getJobMatches } from "../matching/service.js";

function laborBridgeFallback(jobId) {
  return {
    fallbackCandidates: [],
    laborBridgeRecommended: true,
    manualAlertRequired: true,
    reason: `No candidates for job ${jobId}; dispatch labor bridge required.`
  };
}

export async function runAutofill(jobId, contractorUserId, options = {}) {
  const settings = {
    radiusMiles: options.radiusMiles ?? 15,
    allowAdjacency: options.allowAdjacency ?? false,
    allowGeneralLabor: options.allowGeneralLabor ?? false,
    timeoutMinutes: options.timeoutMinutes ?? 60,
    urgencyLevel: options.urgencyLevel ?? "standard"
  };

  const matches = await getJobMatches(jobId, contractorUserId);
  let filtered = matches.filter((m) => m.total_score > 0);

  if (!settings.allowAdjacency) {
    filtered = filtered.filter((m) => m.tradeFitType === "direct");
  }

  if (filtered.length === 0 && settings.allowGeneralLabor) {
    return {
      candidates: [],
      offered: [],
      fallback: laborBridgeFallback(jobId),
      summary: "No direct/adjacent candidates. Labor bridge fallback returned.",
      options: settings
    };
  }

  if (filtered.length === 0) {
    return {
      candidates: [],
      offered: [],
      fallback: {
        fallbackCandidates: matches.slice(0, 5).map((m) => ({ workerUserId: m.worker_user_id, score: m.total_score })),
        laborBridgeRecommended: false,
        manualAlertRequired: true
      },
      summary: "No candidates under current urgency constraints.",
      options: settings
    };
  }

  return {
    candidates: filtered,
    offered: [],
    fallback: null,
    summary: `Autofill candidates prepared (${filtered.length})`,
    options: settings
  };
}
