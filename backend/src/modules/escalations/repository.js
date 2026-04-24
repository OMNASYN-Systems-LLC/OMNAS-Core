import { db } from "../../config/db.js";

export async function insertEscalation(event) {
  const query = `
    INSERT INTO escalation_events (task_id, zone, reason, rule_triggered, severity, suggested_action, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, task_id, zone, reason, rule_triggered, severity, suggested_action, status, created_at, resolved_at
  `;

  const params = [event.taskId, event.zone || "SITE", event.reason, event.ruleTriggered, event.severity || "AMBER", event.suggestedAction || null, event.status || "pending"];
  const { rows } = await db.query(query, params);
  return rows[0] ?? null;
}

export async function listEscalations(status = "pending") {
  const query = `
    SELECT id, task_id, zone, reason, rule_triggered, severity, suggested_action, status, created_at, resolved_at
    FROM escalation_events
    WHERE ($1::TEXT IS NULL OR status = $1)
    ORDER BY created_at DESC
  `;

  const { rows } = await db.query(query, [status]);
  return rows;
}

export async function updateEscalationStatus(id, status, resolutionNote) {
  const query = `
    UPDATE escalation_events
    SET status          = $2::VARCHAR,
        resolution_note = COALESCE($3::TEXT, resolution_note),
        resolved_at     = CASE WHEN $2::VARCHAR = 'resolved' THEN NOW() ELSE resolved_at END
    WHERE id = $1::BIGINT
    RETURNING id, task_id, zone, reason, rule_triggered, severity, suggested_action, status, created_at, resolved_at, resolution_note
  `;

  const { rows } = await db.query(query, [id, status, resolutionNote ?? null]);
  return rows[0] ?? null;
}

export async function findPendingByFingerprint(taskId, zone, reason, ruleTriggered) {
  const query = `
    SELECT id, task_id, zone, reason, rule_triggered, severity, suggested_action, status, created_at, resolved_at
    FROM escalation_events
    WHERE task_id = $1
      AND zone = $2
      AND reason = $3
      AND rule_triggered = $4
      AND status = 'pending'
    LIMIT 1
  `;

  const { rows } = await db.query(query, [taskId, zone || "SITE", reason, ruleTriggered]);
  return rows[0] ?? null;
}
