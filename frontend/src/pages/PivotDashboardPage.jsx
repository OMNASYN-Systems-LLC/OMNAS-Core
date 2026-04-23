import { useEffect, useMemo, useState } from "react";
import { decideEscalation, listEscalations } from "../services/api.js";

export function PivotDashboardPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const response = await listEscalations(auth, "pending");
      setQueue(response.data || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
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
