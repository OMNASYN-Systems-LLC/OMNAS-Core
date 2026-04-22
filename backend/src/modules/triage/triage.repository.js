import { db } from "../../config/db.js";

// LOCKED_JOBS: jobs that have had at least one assignment acceptance or check-in
// blocked due to company / compliance reasons. Pulled from audit_block_log.
export async function getLockedJobs() {
  const { rows } = await db.query(
    `SELECT j.id          AS job_id,
            j.title,
            j.status      AS job_status,
            j.starts_at,
            j.ends_at,
            COUNT(abl.id)                AS block_count,
            MAX(abl.blocked_at)          AS last_blocked_at,
            array_agg(DISTINCT abl.reason_code ORDER BY abl.reason_code)
                                         AS reason_codes,
            array_agg(DISTINCT abl.block_type  ORDER BY abl.block_type)
                                         AS block_types
     FROM audit_block_log abl
     JOIN assignments a ON a.id = abl.entity_id
                       AND abl.entity_type = 'assignment'
     JOIN jobs j        ON j.id = a.job_id
     GROUP BY j.id, j.title, j.status, j.starts_at, j.ends_at
     ORDER BY last_blocked_at DESC
     LIMIT 50`
  );
  return rows;
}

// COMPLIANCE_ALERTS — two sub-sets:
//   1. Companies in PENDING or SUSPENDED state
//   2. Workers with expired credentials

export async function getNonActiveCompanies() {
  const { rows } = await db.query(
    `SELECT cc.id          AS company_id,
            cc.name,
            ccs.status     AS compliance_status,
            ccs.reason,
            ccs.reason_code,
            ccs.effective_at,
            COUNT(wa.worker_user_id) FILTER (WHERE wa.status = 'active') AS active_worker_count
     FROM company_compliance_states ccs
     JOIN contractor_companies cc ON cc.id = ccs.company_id
     LEFT JOIN worker_affiliations wa ON wa.company_id = cc.id
     WHERE ccs.status IN ('PENDING', 'SUSPENDED')
     GROUP BY cc.id, cc.name, ccs.status, ccs.reason, ccs.reason_code, ccs.effective_at
     ORDER BY ccs.effective_at DESC`
  );
  return rows;
}

export async function getWorkersWithExpiredCredentials() {
  const { rows } = await db.query(
    `SELECT wc.worker_user_id,
            wp.first_name,
            wp.last_name,
            array_agg(wc.credential_type ORDER BY wc.expires_at)   AS expired_types,
            array_agg(wc.expires_at::TEXT ORDER BY wc.expires_at)   AS expiry_dates,
            MAX(wc.expires_at)                                       AS most_recent_expiry
     FROM worker_credentials wc
     JOIN worker_profiles wp ON wp.user_id = wc.worker_user_id
     WHERE wc.expires_at IS NOT NULL
       AND wc.expires_at < CURRENT_DATE
     GROUP BY wc.worker_user_id, wp.first_name, wp.last_name
     ORDER BY most_recent_expiry DESC
     LIMIT 50`
  );
  return rows;
}

// GHOST_EVENTS: ghosted assignments + pending ghost-related escalations.
export async function getGhostEvents() {
  const { rows: ghosted } = await db.query(
    `SELECT a.id           AS assignment_id,
            a.job_id,
            a.worker_user_id,
            a.updated_at   AS ghosted_at,
            j.title        AS job_title,
            wp.first_name,
            wp.last_name,
            'ghosted_assignment' AS event_type
     FROM assignments a
     JOIN jobs          j  ON j.id  = a.job_id
     JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
     WHERE a.status = 'ghosted'
     ORDER BY a.updated_at DESC
     LIMIT 25`
  );

  const { rows: escalations } = await db.query(
    `SELECT id           AS escalation_id,
            task_id,
            reason,
            severity,
            suggested_action,
            created_at,
            'ghost_escalation' AS event_type
     FROM escalation_events
     WHERE rule_triggered ILIKE '%GHOST%'
       AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 25`
  );

  return { ghosted, escalations };
}

// Recent block log for a specific job or worker (used by detail drilldown).
export async function getBlockLogForEntity(entityType, entityId, limit = 20) {
  const { rows } = await db.query(
    `SELECT * FROM audit_block_log
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY blocked_at DESC
     LIMIT $3`,
    [entityType, entityId, limit]
  );
  return rows;
}
