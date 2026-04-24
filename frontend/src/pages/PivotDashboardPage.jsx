import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { decideEscalation, getTriageSummary, listEscalations } from "../services/api.js";
import { getAuth } from "../hooks/useAuth.js";

export function PivotDashboardPage() {
  const auth = getAuth();
  const [triage, setTriage] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    if (!auth) return;
    try {
      const [triageRes, escalationsRes] = await Promise.all([
        getTriageSummary(auth),
        listEscalations(auth, "pending")
      ]);
      setTriage(triageRes.data);
      setEscalations(escalationsRes.data || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (!auth) return;
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, []);

  async function submitDecision(id, decision) {
    try {
      await decideEscalation(id, { decision }, auth);
      setMessage(`Decision recorded: ${decision}`);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!auth) {
    return <p>Please <Link to="/login">log in</Link> to access the triage dashboard.</p>;
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", color: "#1976d2", marginBottom: "0.5rem" }}>Triage Dashboard</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Live view — auto-refreshes every 30 seconds.
        {triage && ` Last updated: ${new Date(triage.meta.generatedAt).toLocaleTimeString()}`}
      </p>

      {message && <p style={{ padding: "0.75rem 1rem", background: "#fff3cd", borderRadius: "8px", marginBottom: "1.5rem" }}>{message}</p>}

      {/* LOCKED JOBS */}
      <section style={sectionStyle("#fff8e1", "#f9a825")}>
        <h2 style={headingStyle}>
          Locked Jobs
          {triage && <span style={badgeStyle("#f9a825")}>{triage.meta.lockedJobCount}</span>}
        </h2>
        {!triage ? (
          <p style={mutedText}>Loading...</p>
        ) : triage.lockedJobs.length === 0 ? (
          <p style={mutedText}>No locked jobs.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {triage.lockedJobs.map((job) => (
              <div key={job.jobId} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ color: "#1976d2" }}>Job #{job.jobId}</strong>
                    {job.title && <span style={{ marginLeft: "0.5rem" }}>{job.title}</span>}
                    <span style={{ marginLeft: "1rem", fontSize: "0.85rem", color: "#888" }}>status: {job.jobStatus}</span>
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#d32f2f" }}>{job.blockCount} block(s)</span>
                </div>
                <div style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#555" }}>
                  Reason codes: <code>{(job.reasonCodes || []).join(", ")}</code>
                  &nbsp;&nbsp;Block types: <code>{(job.blockTypes || []).join(", ")}</code>
                </div>
                <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#888" }}>
                  Last blocked: {new Date(job.lastBlockedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COMPLIANCE ALERTS */}
      <section style={sectionStyle("#fce4ec", "#c62828")}>
        <h2 style={headingStyle}>
          Compliance Alerts
          {triage && <span style={badgeStyle("#c62828")}>{triage.meta.complianceAlertCount}</span>}
        </h2>
        {!triage ? (
          <p style={mutedText}>Loading...</p>
        ) : triage.complianceAlerts.length === 0 ? (
          <p style={mutedText}>No compliance alerts.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {triage.complianceAlerts.map((alert, i) => (
              <div key={i} style={cardStyle}>
                {alert.alertType === "COMPANY_STATUS" ? (
                  <>
                    <strong style={{ color: "#c62828" }}>{alert.companyName}</strong>
                    <span style={{ marginLeft: "0.75rem", padding: "0.2rem 0.6rem", background: alert.status === "SUSPENDED" ? "#ffcdd2" : "#fff9c4", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold" }}>
                      {alert.status}
                    </span>
                    {alert.activeWorkerCount > 0 && (
                      <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "#555" }}>
                        {alert.activeWorkerCount} active worker(s) affected
                      </span>
                    )}
                    {alert.reason && <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#555" }}>Reason: {alert.reason}</p>}
                  </>
                ) : (
                  <>
                    <strong>Worker:</strong> {alert.workerName}
                    <span style={{ marginLeft: "0.75rem", padding: "0.2rem 0.6rem", background: "#ffcdd2", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold" }}>CREDENTIAL EXPIRED</span>
                    <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#555" }}>
                      Expired: {(alert.expiredTypes || []).join(", ")}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* GHOST EVENTS */}
      <section style={sectionStyle("#e3f2fd", "#1565c0")}>
        <h2 style={headingStyle}>
          Ghost Events
          {triage && <span style={badgeStyle("#1565c0")}>{triage.meta.ghostEventCount}</span>}
        </h2>
        {!triage ? (
          <p style={mutedText}>Loading...</p>
        ) : (
          <>
            {triage.ghostEvents.ghostedAssignments.length === 0 && triage.ghostEvents.pendingEscalations.length === 0 ? (
              <p style={mutedText}>No ghost events.</p>
            ) : null}
            {triage.ghostEvents.ghostedAssignments.map((g) => (
              <div key={g.assignment_id} style={{ ...cardStyle, marginBottom: "0.5rem" }}>
                <strong>Ghosted assignment #{g.assignment_id}</strong> — Job: {g.job_title}
                <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem", color: "#555" }}>
                  Worker: {g.first_name} {g.last_name}
                </span>
                <span style={{ marginLeft: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
                  Ghosted at: {new Date(g.ghosted_at).toLocaleString()}
                </span>
              </div>
            ))}
            {triage.ghostEvents.pendingEscalations.map((e) => (
              <div key={e.escalation_id} style={{ ...cardStyle, marginBottom: "0.5rem", borderLeft: "3px solid #1565c0" }}>
                <strong>Ghost escalation</strong> — Task: {e.task_id}
                <span style={{ marginLeft: "0.75rem", padding: "0.2rem 0.5rem", background: "#e3f2fd", borderRadius: "8px", fontSize: "0.8rem" }}>{e.severity}</span>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem" }}>{e.reason}</p>
              </div>
            ))}
          </>
        )}
      </section>

      {/* ESCALATION QUEUE (APPROVE / MODIFY / REJECT) */}
      <section style={sectionStyle("#f3e5f5", "#6a1b9a")}>
        <h2 style={headingStyle}>
          Escalation Queue
          <span style={badgeStyle("#6a1b9a")}>{escalations.length}</span>
        </h2>
        {escalations.length === 0 ? (
          <p style={mutedText}>No pending escalations.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {escalations.map((item) => (
              <div key={item.id} style={{ ...cardStyle, borderLeft: `3px solid ${item.severity === "RED" ? "#c62828" : item.severity === "GREEN" ? "#2e7d32" : "#f57f17"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <span style={{ padding: "0.2rem 0.6rem", background: item.severity === "RED" ? "#ffcdd2" : item.severity === "GREEN" ? "#c8e6c9" : "#fff9c4", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold", marginRight: "0.75rem" }}>
                      {item.severity}
                    </span>
                    <strong>Task {item.task_id}</strong> in {item.zone}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => submitDecision(item.id, "APPROVE")} style={decisionBtn("#2e7d32")}>Approve</button>
                    <button type="button" onClick={() => submitDecision(item.id, "MODIFY")}  style={decisionBtn("#f57f17")}>Modify</button>
                    <button type="button" onClick={() => submitDecision(item.id, "REJECT")}  style={decisionBtn("#c62828")}>Reject</button>
                  </div>
                </div>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#333" }}>{item.reason}</p>
                {item.suggested_action && <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#666", fontStyle: "italic" }}>Suggested: {item.suggested_action}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const sectionStyle = (bg, border) => ({
  background: bg,
  border: `1px solid ${border}30`,
  borderRadius: "12px",
  padding: "1.5rem",
  marginBottom: "1.5rem"
});

const headingStyle = {
  fontSize: "1.2rem",
  marginTop: 0,
  marginBottom: "1rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem"
};

const badgeStyle = (color) => ({
  background: color,
  color: "white",
  borderRadius: "12px",
  padding: "0.15rem 0.6rem",
  fontSize: "0.8rem",
  fontWeight: "bold"
});

const cardStyle = {
  background: "white",
  borderRadius: "8px",
  padding: "0.75rem 1rem",
  border: "1px solid #e0e0e0"
};

const mutedText = { color: "#888", margin: 0 };

const decisionBtn = (color) => ({
  padding: "0.4rem 0.9rem",
  background: color,
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: "bold"
});
