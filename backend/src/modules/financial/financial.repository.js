import { db } from "../../config/db.js";

export async function getFinancialContext(jobId, contractorUserId) {
  const jobQuery = `
    SELECT j.id, j.title, j.posted_by, j.starts_at, j.ends_at, j.pay_rate, j.metadata
    FROM jobs j
    WHERE j.id = $1 AND j.posted_by = $2
  `;

  const logsQuery = `
    SELECT dl.id,
           dl.log_date,
           dl.job_id,
           dl.worker_user_id,
           dl.hours_worked,
           dl.crew_size,
           dl.assigned_category,
           dl.detected_categories,
           dl.confidence,
           dl.weather,
           dl.work_summary,
           dl.work_completed,
           dl.estimated_hours,
           a.trade_primary
    FROM daily_logs dl
    LEFT JOIN assignments a ON a.id = dl.assignment_id
    WHERE dl.job_id = $1
    ORDER BY dl.log_date DESC, dl.id DESC
  `;

  const assignmentCountQuery = `
    SELECT COUNT(*)::INT AS active_workers
    FROM assignments
    WHERE job_id = $1
      AND status IN ('accepted', 'active', 'completed')
  `;

  const [jobResult, logsResult, assignmentCountResult] = await Promise.all([
    db.query(jobQuery, [jobId, contractorUserId]),
    db.query(logsQuery, [jobId]),
    db.query(assignmentCountQuery, [jobId])
  ]);

  return {
    job: jobResult.rows[0] ?? null,
    logs: logsResult.rows,
    activeWorkers: assignmentCountResult.rows[0]?.active_workers || 0
  };
}

export async function getFinancialProfileByJob(jobId) {
  const query = `
    SELECT project_id, job_id, contract_value, total_duration_days, daily_burn_rate,
           labor_burden_multiplier, critical_path_weight, created_at, updated_at
    FROM project_financial_profiles
    WHERE job_id = $1
  `;

  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? null;
}

export async function upsertFinancialProfile({ jobId, contractValue, totalDurationDays, dailyBurnRate, laborBurdenMultiplier, criticalPathWeight }) {
  const query = `
    INSERT INTO project_financial_profiles (
      job_id, contract_value, total_duration_days, daily_burn_rate, labor_burden_multiplier, critical_path_weight, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (job_id) DO UPDATE SET
      contract_value = EXCLUDED.contract_value,
      total_duration_days = EXCLUDED.total_duration_days,
      daily_burn_rate = COALESCE(EXCLUDED.daily_burn_rate, project_financial_profiles.daily_burn_rate),
      labor_burden_multiplier = EXCLUDED.labor_burden_multiplier,
      critical_path_weight = EXCLUDED.critical_path_weight,
      updated_at = NOW()
    RETURNING project_id, job_id, contract_value, total_duration_days, daily_burn_rate,
              labor_burden_multiplier, critical_path_weight, created_at, updated_at
  `;

  const params = [jobId, contractValue, totalDurationDays, dailyBurnRate, laborBurdenMultiplier, criticalPathWeight];
  const { rows } = await db.query(query, params);
  return rows[0] ?? null;
}

export async function insertProfitErosionEvents(projectId, events = []) {
  if (events.length === 0) return [];

  const query = `
    INSERT INTO profit_erosion_events (
      project_id, category, driver_id, daily_impact_usd, confidence_score, description, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, project_id, category, driver_id, daily_impact_usd, confidence_score, description, metadata, created_at
  `;

  const inserted = [];
  for (const event of events) {
    const { rows } = await db.query(query, [
      projectId,
      event.category,
      event.driverId,
      event.dailyImpactUsd,
      event.confidenceScore,
      event.description,
      JSON.stringify(event.metadata || {})
    ]);
    if (rows[0]) inserted.push(rows[0]);
  }

  return inserted;
}

export async function listProfitErosionEvents(projectId, limit = 50) {
  const query = `
    SELECT id, project_id, category, driver_id, daily_impact_usd, confidence_score, description, metadata, created_at
    FROM profit_erosion_events
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const { rows } = await db.query(query, [projectId, limit]);
  return rows;
}

export async function insertFinancialAuditLog(projectId, status, message, context = {}) {
  const query = `
    INSERT INTO financial_calculation_audit_log (project_id, status, message, context)
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING id, project_id, run_type, status, message, context, created_at
  `;

  const { rows } = await db.query(query, [projectId, status, message, JSON.stringify(context)]);
  return rows[0] ?? null;
}
