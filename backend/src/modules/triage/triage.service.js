import {
  getLockedJobs,
  getNonActiveCompanies,
  getWorkersWithExpiredCredentials,
  getGhostEvents,
  getBlockLogForEntity
} from "./triage.repository.js";

// Aggregates the three operational triage buckets for the GC / Prime view.
// Data is collected in parallel; failure in one bucket degrades gracefully.
export async function getTriageSummary() {
  const [lockedJobs, nonActiveCompanies, workersWithExpired, ghostData] = await Promise.all([
    getLockedJobs(),
    getNonActiveCompanies(),
    getWorkersWithExpiredCredentials(),
    getGhostEvents()
  ]);

  const complianceAlerts = [
    ...nonActiveCompanies.map((c) => ({
      alertType:          "COMPANY_STATUS",
      companyId:          c.company_id,
      companyName:        c.name,
      status:             c.compliance_status,
      reason:             c.reason ?? null,
      reasonCode:         c.reason_code ?? null,
      effectiveAt:        c.effective_at,
      activeWorkerCount:  Number(c.active_worker_count ?? 0)
    })),
    ...workersWithExpired.map((w) => ({
      alertType:    "CREDENTIAL_EXPIRED",
      workerUserId: w.worker_user_id,
      workerName:   `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || w.worker_user_id,
      expiredTypes: w.expired_types,
      expiryDates:  w.expiry_dates,
      mostRecentExpiry: w.most_recent_expiry
    }))
  ];

  return {
    meta: {
      generatedAt:          new Date().toISOString(),
      lockedJobCount:       lockedJobs.length,
      complianceAlertCount: complianceAlerts.length,
      ghostEventCount:      ghostData.ghosted.length + ghostData.escalations.length
    },
    lockedJobs: lockedJobs.map((j) => ({
      jobId:         Number(j.job_id),
      title:         j.title,
      jobStatus:     j.job_status,
      startsAt:      j.starts_at,
      endsAt:        j.ends_at,
      blockCount:    Number(j.block_count),
      lastBlockedAt: j.last_blocked_at,
      reasonCodes:   j.reason_codes,
      blockTypes:    j.block_types
    })),
    complianceAlerts,
    ghostEvents: {
      ghostedAssignments: ghostData.ghosted,
      pendingEscalations: ghostData.escalations
    }
  };
}

// Block log drilldown — used by the detail panel.
export async function getEntityBlockLog(entityType, entityId) {
  const allowed = ["assignment", "daily_log"];
  if (!allowed.includes(entityType)) {
    const err = new Error(`entityType must be one of: ${allowed.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
  return getBlockLogForEntity(entityType, Number(entityId));
}
