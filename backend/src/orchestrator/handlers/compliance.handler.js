import { db } from "../../config/db.js";
import { insertEscalation, findPendingByFingerprint } from "../../modules/escalations/repository.js";
import { logBlockEvent, getCompanyWorkerIds } from "../../modules/compliance/compliance.repository.js";

const BLOCK_REASON = {
  COMPANY_SUSPENDED:  "COMPANY_SUSPENDED",
  CREDENTIAL_EXPIRED: "CREDENTIAL_EXPIRED"
};

// ON_COMPANY_ACTIVATED
// Resolves any pending suspension escalations for the company so the triage view
// clears automatically. Does not alter assignment statuses — acceptance is now
// unblocked by the compliance check returning clear.
export async function handleCompanyActivated({ companyId, changedBy }) {
  try {
    const { rowCount } = await db.query(
      `UPDATE escalation_events
       SET status          = 'resolved',
           resolution_note = 'Company compliance activated — block lifted',
           resolved_at     = NOW()
       WHERE task_id       = $1
         AND rule_triggered = 'COMPANY_SUSPENDED'
         AND status         = 'pending'`,
      [companyId]
    );
    console.log(`[Compliance] ON_COMPANY_ACTIVATED company=${companyId} resolved=${rowCount} escalation(s)`);
  } catch (err) {
    console.error("[Compliance] handleCompanyActivated error:", err.message);
  }
}

// ON_COMPANY_SUSPENDED
// Creates an escalation event for each affected offered/accepted/active assignment
// and records a block entry per assignment so the audit trail shows when the lock
// was applied. Offered assignments remain in 'offered' status — acceptance will be
// blocked at the accept boundary by checkAcceptanceEligibility.
export async function handleCompanySuspended({ companyId, reason, changedBy }) {
  try {
    const workerIds = await getCompanyWorkerIds(companyId);

    if (workerIds.length === 0) {
      console.log(`[Compliance] ON_COMPANY_SUSPENDED company=${companyId} — no active workers`);
      return;
    }

    const { rows: affected } = await db.query(
      `SELECT a.id AS assignment_id, a.worker_user_id, a.job_id, a.status
       FROM assignments a
       WHERE a.worker_user_id = ANY($1::uuid[])
         AND a.status IN ('offered', 'accepted', 'active')`,
      [workerIds]
    );

    for (const row of affected) {
      // Build the reason string once so the fingerprint check and the stored
      // reason are identical — previously they differed, breaking idempotency.
      const escReason = `Company suspended — assignment ${row.assignment_id} locked for worker ${row.worker_user_id}.${reason ? ` ${reason}` : ""}`;

      // Idempotent: skip if this exact escalation already exists
      const existing = await findPendingByFingerprint(
        companyId,
        "compliance",
        escReason,
        "COMPANY_SUSPENDED"
      );

      if (!existing) {
        await insertEscalation({
          taskId:          companyId,
          zone:            "compliance",
          reason:          escReason,
          ruleTriggered:   "COMPANY_SUSPENDED",
          severity:        "HIGH",
          suggestedAction: "Review and reassign affected workers or restore company compliance before accepting new assignments.",
          status:          "pending"
        });
      }

      await logBlockEvent({
        blockType:     "OFFER_LOCK",
        reasonCode:    BLOCK_REASON.COMPANY_SUSPENDED,
        reasonDetail:  `Company suspended — assignment id=${row.assignment_id} locked (status: ${row.status}).${reason ? ` Reason: ${reason}` : ""}`,
        entityType:    "assignment",
        entityId:      row.assignment_id,
        workerUserId:  row.worker_user_id,
        companyId,
        context:       { jobId: row.job_id, assignmentStatus: row.status, reason: reason ?? null }
      });
    }

    console.log(`[Compliance] ON_COMPANY_SUSPENDED company=${companyId} — ${affected.length} assignment(s) escalated`);
  } catch (err) {
    console.error("[Compliance] handleCompanySuspended error:", err.message);
  }
}

// ON_CREDENTIAL_EXPIRED
// Creates a medium-severity escalation so the GC/Prime triage surface surfaces it.
// Check-in will be hard-blocked by checkCheckinEligibility until renewed.
export async function handleCredentialExpired({ workerUserId, credentialType, expiresAt }) {
  try {
    const reason = `Credential expired: ${credentialType}${expiresAt ? ` (expired ${expiresAt})` : ""}`;

    const existing = await findPendingByFingerprint(
      workerUserId,
      "compliance",
      reason,
      "CREDENTIAL_EXPIRED"
    );

    if (!existing) {
      await insertEscalation({
        taskId:          workerUserId,
        zone:            "compliance",
        reason,
        ruleTriggered:   "CREDENTIAL_EXPIRED",
        severity:        "AMBER",
        suggestedAction: "Worker must renew this credential before their next shift. Check-in will be blocked until resolved.",
        status:          "pending"
      });
    }

    await logBlockEvent({
      blockType:     "CHECKIN",
      reasonCode:    BLOCK_REASON.CREDENTIAL_EXPIRED,
      reasonDetail:  reason,
      entityType:    "daily_log",
      entityId:      null,
      workerUserId,
      companyId:     null,
      context:       { credentialType, expiresAt: expiresAt ?? null }
    });

    console.log(`[Compliance] ON_CREDENTIAL_EXPIRED worker=${workerUserId} type=${credentialType}`);
  } catch (err) {
    console.error("[Compliance] handleCredentialExpired error:", err.message);
  }
}
