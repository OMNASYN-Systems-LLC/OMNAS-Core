import { db } from "../../config/db.js";

// 🔥 JOB SNAPSHOT (codex - quick dashboard metrics)
export async function getJobActivitySnapshot(jobId, contractorUserId) {
  const jobQuery = `
    SELECT id, title, posted_by, status, created_at, updated_at
    FROM jobs
    WHERE id = $1 AND posted_by = $2
  `;

  const logsQuery = `
    SELECT 
      COUNT(*)::INT AS total_logs,
      COUNT(*) FILTER (WHERE log_date = CURRENT_DATE)::INT AS today_logs,
      COUNT(*) FILTER (WHERE log_date = CURRENT_DATE - 1)::INT AS yesterday_logs,
      MAX(submitted_at) AS last_log_at,
      AVG(hours_worked) FILTER (WHERE log_date >= CURRENT_DATE - 7)::NUMERIC(4,2) AS avg_daily_hours_7d
    FROM daily_logs dl
    JOIN assignments a ON a.id = dl.assignment_id
    WHERE a.job_id = $1
  `;

  const assignmentsQuery = `
    SELECT 
      COUNT(*)::INT AS total_assignments,
      COUNT(*) FILTER (WHERE status = 'active')::INT AS active_assignments,
      COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_assignments
    FROM assignments
    WHERE job_id = $1
  `;

  const [jobResult, logsResult, assignmentsResult] = await Promise.all([
    db.query(jobQuery, [jobId, contractorUserId]),
    db.query(logsQuery, [jobId]),
    db.query(assignmentsQuery, [jobId])
  ]);

  if (!jobResult.rows[0]) return null;

  return {
    job: jobResult.rows[0],
    logs: logsResult.rows[0] || { 
      total_logs: 0, 
      today_logs: 0, 
      yesterday_logs: 0, 
      last_log_at: null,
      avg_daily_hours_7d: 0 
    },
    assignments: assignmentsResult.rows[0] || {
      total_assignments: 0,
      active_assignments: 0,
      completed_assignments: 0
    }
  };
}

// 🔥 JOB COMMAND DATA (main - detailed analytics)
export async function getJobForCommand(jobId) {
  const query = `
    SELECT 
      j.id, j.organization_id, j.posted_by, j.title, j.description,
      j.site_zip, j.starts_at, j.ends_at, j.pay_rate, j.status,
      j.created_at, j.updated_at,
      j.metadata,
      (SELECT COUNT(*) FROM job_required_skills jrs WHERE jrs.job_id = j.id)::INT AS required_slots,
      (SELECT COUNT(*) FROM assignments a WHERE a.job_id = j.id AND a.status IN ('accepted', 'active'))::INT AS active_workers
    FROM jobs j
    WHERE j.id = $1
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? null;
}

export async function getAssignmentsForJob(jobId) {
  const query = `
    SELECT 
      a.id, a.job_id, a.worker_user_id, a.assigned_by, a.status,
      a.offered_at, a.responded_at, a.started_at, a.completed_at,
      a.created_at, a.updated_at,
      wp.first_name, wp.last_name, wp.trade_primary,
      (SELECT COUNT(*) FROM daily_logs dl WHERE dl.assignment_id = a.id)::INT AS log_count
    FROM assignments a
    LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.job_id = $1
    ORDER BY a.created_at ASC
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows;
}

export async function getLogsForJob(jobId) {
  const query = `
    SELECT 
      dl.id, dl.assignment_id, dl.job_id, dl.log_date, dl.hours_worked,
      dl.work_summary, dl.issues, dl.issues_blockers, dl.weather,
      dl.detected_categories, dl.confidence, dl.submitted_at, dl.submitted_by,
      a.worker_user_id, wp.first_name, wp.last_name
    FROM daily_logs dl
    JOIN assignments a ON a.id = dl.assignment_id
    LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_user_id
    WHERE a.job_id = $1
    ORDER BY dl.log_date DESC, dl.submitted_at DESC
    LIMIT 100
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows;
}

export async function getMatchCountsForJob(jobId) {
  const query = `
    SELECT 
      COUNT(*)::INT AS total_matches,
      COALESCE(AVG(score), 0)::NUMERIC(10,2) AS avg_score,
      COALESCE(MAX(score), 0)::NUMERIC(10,2) AS top_score,
      COUNT(*) FILTER (WHERE score >= 85)::INT AS high_quality_matches
    FROM match_scores
    WHERE job_id = $1
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? { 
    total_matches: 0, 
    avg_score: 0, 
    top_score: 0,
    high_quality_matches: 0 
  };
}

// 🔥 PROFIT IMPACT SNAPSHOT (construction bonus)
export async function getJobFinancialSnapshot(jobId) {
  const query = `
    SELECT 
      COALESCE(SUM(dl.hours_worked * j.pay_rate), 0)::NUMERIC(10,2) AS total_labor_cost,
      COALESCE(AVG(dl.hours_worked), 0)::NUMERIC(4,2) AS avg_daily_hours,
      COUNT(DISTINCT dl.assignment_id)::INT AS unique_workers,
      COUNT(dl.*)::INT AS total_logs
    FROM daily_logs dl
    JOIN assignments a ON a.id = dl.assignment_id
    JOIN jobs j ON j.id = a.job_id
    WHERE a.job_id = $1
  `;
  const { rows } = await db.query(query, [jobId]);
  return rows[0] ?? {
    total_labor_cost: 0,
    avg_daily_hours: 0,
    unique_workers: 0,
    total_logs: 0
  };
}