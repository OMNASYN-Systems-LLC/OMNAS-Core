import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/auth-context.jsx";
import { decideEscalation, getTriageDashboard, listEscalations } from "../services/api.js";

function normalizeBucket(bucket) {
  if (!bucket) return [];
  if (Array.isArray(bucket)) return bucket;
  if (Array.isArray(bucket.items)) return bucket.items;
  return [];
}

export function PivotDashboardPage() {
  const { authHeaders: auth } = useAuth();
  const [queue, setQueue] = useState([]);
  const [triage, setTriage] = useState({ LOCKED_JOBS: [], COMPLIANCE_ALERTS: [], GHOST_EVENTS: [] });
  const [message, setMessage] = useState("");

  async function refresh() {
    const nextMessage = [];

    try {
      const triageResponse = await getTriageDashboard(auth);
      const triageData = triageResponse.data || {};
      setTriage({
        LOCKED_JOBS: normalizeBucket(triageData.LOCKED_JOBS),
        COMPLIANCE_ALERTS: normalizeBucket(triageData.COMPLIANCE_ALERTS),
        GHOST_EVENTS: normalizeBucket(triageData.GHOST_EVENTS)
      });
    } catch (error) {
      nextMessage.push(`Triage feed unavailable: ${error.message}`);
      setTriage({ LOCKED_JOBS: [], COMPLIANCE_ALERTS: [], GHOST_EVENTS: [] });
    }

    try {
      const response = await listEscalations(auth, "pending");
      setQueue(response.data || []);
    } catch (error) {
      nextMessage.push(`Escalation queue unavailable: ${error.message}`);
      setQueue([]);
    }

    setMessage(nextMessage.join(" | "));
  }

  useEffect(() => {
    refresh();
  }, []);

  const sections = useMemo(() => {
    const activeEscalations = queue.filter((item) => item.severity === "AMBER");
    const hardLocks = queue.filter((item) => item.severity === "RED" || item.rule_triggered === "critical_distance_exclusion");
    const autoResolutions = queue.filter((item) => item.severity === "GREEN");
    return { activeEscalations, hardLocks, autoResolutions };
  }, [queue]);

  async function submitDecision(id, decision) {
    try {
      await decideEscalation(id, { decision }, auth);
      setMessage(`Decision recorded: ${decision}`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section>
      <h1>Daily Pivot Dashboard</h1>
      <p className="message">Manual superintendent queue for amber-layer conflicts. Badge count: {sections.activeEscalations.length}</p>

      <article className="analysis-card">
        <h2>Triage Feed</h2>
        <p><strong>LOCKED_JOBS:</strong> {triage.LOCKED_JOBS.length}</p>
        <p><strong>COMPLIANCE_ALERTS:</strong> {triage.COMPLIANCE_ALERTS.length}</p>
        <p><strong>GHOST_EVENTS:</strong> {triage.GHOST_EVENTS.length}</p>
      </article>

      <article className="analysis-card status-yellow">
        <h2>🟡 Active Escalations (Amber)</h2>
        {sections.activeEscalations.length === 0 ? <p className="message">No active escalations.</p> : null}
        {sections.activeEscalations.map((item) => (
          <div key={item.id} className="analysis-card escalation-card">
            <p><strong>Conflict:</strong> Task {item.task_id} in {item.zone}</p>
            <p><strong>Why system paused:</strong> {item.reason}</p>
            <p><strong>Suggested fix:</strong> {item.suggested_action || "Manual superintendent review"}</p>
            <div className="decision-row">
              <button type="button" onClick={() => submitDecision(item.id, "APPROVE")}>Approve</button>
              <button type="button" onClick={() => submitDecision(item.id, "MODIFY")}>Modify</button>
              <button type="button" onClick={() => submitDecision(item.id, "REJECT")}>Reject</button>
            </div>
          </div>
        ))}
      </article>

      <article className="analysis-card status-red">
        <h2>🔴 Hard Locks (Red)</h2>
        {sections.hardLocks.length === 0 ? <p className="message">No hard locks in queue.</p> : null}
        <ul>
          {sections.hardLocks.map((item) => (
            <li key={`lock-${item.id}`}>{item.task_id} · {item.reason}</li>
          ))}
        </ul>
      </article>

      <article className="analysis-card status-green">
        <h2>🟢 Auto Resolutions (Green)</h2>
        <p className="message">No push notifications yet. Dashboard badge is enabled now.</p>
        {sections.autoResolutions.length === 0 ? <p className="message">No auto resolutions in queue feed.</p> : null}
        <ul>
          {sections.autoResolutions.map((item) => (
            <li key={`auto-${item.id}`}>{item.task_id} · {item.reason}</li>
          ))}
        </ul>
      </article>

      {message ? <p className="message">{message}</p> : null}
    </section>
  );
}
