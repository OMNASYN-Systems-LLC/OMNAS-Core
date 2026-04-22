import { isJobReplacing, setReplacementLock } from "../../modules/jobs/repository.js";
import { markRiskState } from "../../modules/scheduling/service.js";
import { runAutofill } from "../../modules/assembler/assembler.service.js";

// Emergency overrides forwarded to the assembler layer.
// minScoreThreshold (0–1 fraction) lowers the offer floor to 75 raw points,
// allowing a wider candidate pool without touching the matching scoring math.
const EMERGENCY_OPTIONS = {
  priority:          "EMERGENCY",
  radiusMultiplier:  1.5,
  payMultiplier:     1.15,
  minScoreThreshold: 0.75,
  timeoutMinutes:    15,
};

export async function handleGhostDetected(payload) {
  const { jobId, contractorUserId } = payload;

  // Idempotency guard — if this job is already cycling through replacement,
  // a second ghost event for the same job is a no-op.
  const alreadyReplacing = await isJobReplacing(jobId);
  if (alreadyReplacing) {
    console.log(`[GhostHandler] job ${jobId} already in replacement mode — skipping`);
    return;
  }

  // 1. Lock the job into replacement mode (writes to jobs.metadata.ghost_recovery)
  await setReplacementLock(jobId);

  // 2. Advisory scheduling signal — marks AT_RISK + stores ghost_event_link and
  //    ripple_delay_est. No CPM resequencing in this pack.
  await markRiskState(jobId, payload);

  // 3. Emergency autofill — lowers offer floor, annotates offers with emergency
  //    flag and multiplier metadata for the labor bridge (future pack).
  await runAutofill(jobId, contractorUserId, EMERGENCY_OPTIONS);
}
