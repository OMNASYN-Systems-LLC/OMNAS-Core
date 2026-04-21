import { assertNonNegativeInteger } from "../../utils/validation.js";
import { createBatchAssignmentOffers } from "../assignments/service.js";
import { getRankedMatchList } from "../matching/service.js";
import {
  expireTimedOutOffers,
  getActiveWorkerIdsForJob,
  getJobSlotStatus,
} from "./assembler.repository.js";

// Score thresholds (raw points on the 0–125 matching scale)
const TIER_AUTO  = 90; // score > 90  → auto-create one offer per open slot
const TIER_OFFER = 70; // score 70–90 → surface top-3 as offers
                       // score < 70  → adjacent-trade fallback only

const DEFAULT_TIMEOUT_MINUTES = 30;
const MAX_OFFER_BATCH  = 5;  // hard cap on offers created per run
const MAX_FALLBACK     = 5;  // hard cap on fallback candidates returned

function formatCandidate(m) {
  return {
    workerId:     m.worker_user_id,
    workerName:   m.worker_name ?? `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim(),
    tradePrimary: m.trade_primary ?? null,
    score:        Number(m.total_score ?? m.score ?? 0),
    scoreBreakdown: m.score_breakdown ?? null,
  };
}

export async function runAutofill(jobId, contractorUserId, options = {}) {
  assertNonNegativeInteger(jobId, "jobId");

  const timeoutMinutes = Math.max(
    1,
    Number.isFinite(Number(options.timeoutMinutes))
      ? Number(options.timeoutMinutes)
      : DEFAULT_TIMEOUT_MINUTES
  );

  // 1. Verify ownership and read initial state
  const initial = await getJobSlotStatus(jobId, contractorUserId);
  if (!initial) {
    const err = new Error("Job not found or access forbidden");
    err.statusCode = 404;
    throw err;
  }

  // 2. Expire stale offers — frees slots for re-assignment
  const timedOut = await expireTimedOutOffers(jobId, timeoutMinutes);

  // 3. Re-read slot status after expiry
  const status = await getJobSlotStatus(jobId, contractorUserId);
  const { openSlots, requiredSlots, filledCount, pendingCount } = status;

  const summary = { requiredSlots, filledCount, pendingCount, openSlots, timedOut: timedOut.length };

  // Fully staffed — nothing to do
  if (openSlots <= 0) {
    return { summary, offered: [], fallback: [], skipped: [] };
  }

  // 4. Load ranked candidates (cache-first, recompute on miss)
  const ranked = await getRankedMatchList(jobId, contractorUserId);

  // 5. Remove workers that already have a live assignment on this job
  const existingIds = new Set(await getActiveWorkerIdsForJob(jobId));
  const eligible = ranked.filter((m) => !existingIds.has(m.worker_user_id));

  // Never return empty — if every ranked candidate is already assigned,
  // surface them as fallback so the caller always gets something actionable.
  if (eligible.length === 0) {
    return {
      summary,
      offered:  [],
      fallback: ranked.slice(0, MAX_FALLBACK).map((m) => ({ ...formatCandidate(m), tier: "fallback" })),
      skipped:  [],
    };
  }

  // 6. Partition by tier
  const tier1 = eligible.filter((m) => Number(m.total_score ?? m.score) > TIER_AUTO);
  const tier2 = eligible
    .filter((m) => {
      const s = Number(m.total_score ?? m.score);
      return s >= TIER_OFFER && s <= TIER_AUTO;
    })
    .slice(0, 3); // top-3 offer candidates
  const tier3 = eligible.filter((m) => Number(m.total_score ?? m.score) < TIER_OFFER);

  // 7. Determine who gets an offer this run
  //    - Tier-1 fills up to openSlots automatically
  //    - Tier-2 fills remaining open slots (up to 3 at a time)
  //    - Total offers capped at MAX_OFFER_BATCH and openSlots
  const toOffer = [...tier1, ...tier2].slice(0, Math.min(openSlots, MAX_OFFER_BATCH));

  // 8. Batch-create offers (deduplication enforced inside the transaction)
  const { created, skipped: batchSkipped } = await createBatchAssignmentOffers(
    contractorUserId,
    jobId,
    toOffer.map((m) => m.worker_user_id)
  );

  const createdByWorker = new Map(created.map((a) => [a.worker_user_id, a]));

  const offered = toOffer.map((m) => ({
    ...formatCandidate(m),
    tier:         Number(m.total_score ?? m.score) > TIER_AUTO ? "auto" : "offer",
    assignmentId: createdByWorker.get(m.worker_user_id)?.id ?? null,
    created:      createdByWorker.has(m.worker_user_id),
  }));

  const skipped = batchSkipped.map((s) => ({
    workerId: s.workerUserId,
    reason:   s.reason,
  }));

  // 9. Build fallback (adjacent-trade candidates, never auto-assigned)
  const fallback = tier3.slice(0, MAX_FALLBACK).map((m) => ({
    ...formatCandidate(m),
    tier: "adjacent",
  }));

  // Guarantee non-empty response when no direct offer was possible
  if (offered.length === 0 && fallback.length === 0 && eligible.length > 0) {
    eligible.slice(0, MAX_FALLBACK).forEach((m) =>
      fallback.push({ ...formatCandidate(m), tier: "fallback" })
    );
  }

  return { summary, offered, fallback, skipped };
}
