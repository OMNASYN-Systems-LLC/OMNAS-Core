import { useEffect, useMemo, useState } from "react";
import {
  acceptAssignment,
  completeAssignment,
  declineAssignment,
  getAssignmentLogs,
  listAssignments,
  startAssignment,
  submitDailyLog,
  submitDailyExecutionLog,
  submitVoiceLog
} from "../services/api.js";
import { getStoredAuth } from "../hooks/useAuth.js";

// ─── Offline queue ─────────────────────────────────────────────────────────────

const PENDING_KEY = "omnas_pending_logs_v1";

function loadPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function savePending(items) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

// ─── Shared micro-styles ───────────────────────────────────────────────────────

const btn = {
  primary: {
    padding: "0.75rem 1.5rem",
    background: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.95rem"
  },
  success: {
    padding: "0.75rem 1.5rem",
    background: "#28a745",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.95rem"
  },
  danger: {
    padding: "0.75rem 1.5rem",
    background: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "0.95rem"
  }
};

const fieldStyle = {
  width: "100%",
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  border: "1px solid #dee2e6",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  marginBottom: "0.75rem"
};

const WORKER_FALLBACK = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };

// ─── Main component ────────────────────────────────────────────────────────────

export function WorkerDashboardPage() {
  const auth = getStoredAuth() ?? WORKER_FALLBACK;

  const [assignments, setAssignments]             = useState([]);
  const [logsByAssignment, setLogsByAssignment]   = useState({});
  const [message, setMessage]                     = useState("");
  const [messageType, setMessageType]             = useState("info"); // info | success | warn | error
  const [activeDayId, setActiveDayId]             = useState(null);
  const [draft, setDraft]                         = useState({ work_completed: "", issues_blockers: "", photos: [""] });
  const [pendingLogs, setPendingLogs]             = useState(loadPending);
  const [logForms, setLogForms]                   = useState({});

  // Persist offline queue whenever it changes
  useEffect(() => { savePending(pendingLogs); }, [pendingLogs]);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      const res = await listAssignments(auth);
      const rows = res.data ?? [];
      setAssignments(rows);

      const entries = await Promise.all(
        rows.map(async (a) => {
          try {
            const lr = await getAssignmentLogs(a.id, auth);
            return [a.id, lr.data ?? []];
          } catch {
            return [a.id, []];
          }
        })
      );
      setLogsByAssignment(Object.fromEntries(entries));
    } catch (err) {
      flash(err.message, "error");
    }
  }

  function flash(text, type = "info") {
    setMessage(text);
    setMessageType(type);
  }

  // ─── Assignment actions ──────────────────────────────────────────────────────

  async function runAction(apiCall, id) {
    try {
      await apiCall(id, auth);
      flash("Updated.", "success");
      await refresh();
    } catch (err) {
      // Surface compliance block reason code when present
      const suffix = err.message.includes("blocked") ? "" : "";
      flash(err.message + suffix, "error");
    }
  }

  // ─── Voice log (draft → submit) ──────────────────────────────────────────────

  async function handleVoiceDraft() {
    if (!activeDayId) { flash("Tap 'Start Day' on an active assignment first.", "warn"); return; }
    try {
      const res = await submitVoiceLog({
        assignmentId: activeDayId,
        text:   draft.work_completed,
        issues: draft.issues_blockers,
        photos: draft.photos.filter(Boolean),
        isDraft: true
      }, auth);
      const prefill = res.data?.prefill ?? {};
      setDraft((prev) => ({ ...prev, work_completed: prefill.work_completed || prev.work_completed }));
      flash("Voice captured — review then submit.", "success");
    } catch (err) {
      flash(err.message, "error");
    }
  }

  async function handleSubmitVoice() {
    if (!activeDayId) { flash("Tap 'Start Day' first.", "warn"); return; }
    const payload = {
      assignmentId:   activeDayId,
      workCompleted:  draft.work_completed,
      workSummary:    draft.work_completed || "Field work completed",
      issuesBlockers: draft.issues_blockers || null,
      photos:         draft.photos.filter(Boolean),
      weather:        "manual_pending",
      crewSize:       1,
      hoursWorked:    8,
      logDate:        new Date().toISOString().slice(0, 10)
    };
    try {
      await submitDailyExecutionLog(payload, auth);
      flash("Log submitted.", "success");
      setDraft({ work_completed: "", issues_blockers: "", photos: [""] });
      setPendingLogs((prev) => prev.filter((p) => p.assignmentId !== activeDayId));
      await refresh();
    } catch (err) {
      // Compliance block: surface reason clearly
      if (err.message.toLowerCase().includes("blocked")) {
        flash(err.message, "error");
        return;
      }
      // Network failure: queue offline
      setPendingLogs((prev) => [...prev, payload]);
      flash("Saved offline — will sync when connection returns.", "warn");
    }
  }

  async function retryPending() {
    if (pendingLogs.length === 0) { flash("Nothing queued.", "success"); return; }
    const remaining = [];
    for (const payload of pendingLogs) {
      try { await submitDailyExecutionLog(payload, auth); }
      catch { remaining.push(payload); }
    }
    setPendingLogs(remaining);
    const n = pendingLogs.length - remaining.length;
    flash(n > 0 ? `Synced ${n} log(s). ${remaining.length} still pending.` : "Sync failed — check connection.", n > 0 ? "success" : "error");
    await refresh();
  }

  // ─── Form log ────────────────────────────────────────────────────────────────

  function getLogForm(id) {
    return logForms[id] ?? { logDate: new Date().toISOString().slice(0, 10), hoursWorked: "8", workSummary: "", issues: "" };
  }

  function setField(id, key, val) {
    setLogForms((prev) => ({ ...prev, [id]: { ...getLogForm(id), [key]: val } }));
  }

  async function handleFormLog(id, e) {
    e.preventDefault();
    try {
      const form = getLogForm(id);
      await submitDailyLog(id, { ...form, hoursWorked: Number(form.hoursWorked) }, auth);
      flash("Log submitted.", "success");
      setLogForms((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await refresh();
    } catch (err) {
      flash(err.message, "error");
    }
  }

  // ─── Derived lists ────────────────────────────────────────────────────────────

  const offered   = useMemo(() => assignments.filter((a) => a.status === "offered"),                        [assignments]);
  const active    = useMemo(() => assignments.filter((a) => ["accepted", "active"].includes(a.status)),     [assignments]);
  const completed = useMemo(() => assignments.filter((a) => a.status === "completed"),                      [assignments]);

  // ─── Message banner ───────────────────────────────────────────────────────────

  const bannerColor = {
    success: { bg: "#d4edda", border: "#28a745", text: "#155724" },
    warn:    { bg: "#fff3cd", border: "#ffc107", text: "#856404" },
    error:   { bg: "#f8d7da", border: "#dc3545", text: "#721c24" },
    info:    { bg: "#cce5ff", border: "#1976d2", text: "#004085" }
  }[messageType] ?? { bg: "#cce5ff", border: "#1976d2", text: "#004085" };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1.5rem 1rem" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>Worker Dashboard</h1>
        <button onClick={refresh} style={{ ...btn.primary, padding: "0.5rem 1.2rem", fontSize: "0.85rem" }}>Refresh</button>
      </div>

      {/* Message banner */}
      {message && (
        <div style={{ padding: "0.9rem 1.2rem", marginBottom: "1.25rem", background: bannerColor.bg, borderRadius: "10px", borderLeft: `4px solid ${bannerColor.border}`, color: bannerColor.text, fontSize: "0.9rem" }}>
          {message}
          <button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: bannerColor.text, fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Offline sync bar */}
      {pendingLogs.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.2rem", marginBottom: "1.25rem", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107" }}>
          <span style={{ fontSize: "0.9rem" }}><strong>{pendingLogs.length}</strong> log{pendingLogs.length !== 1 ? "s" : ""} queued offline</span>
          <button onClick={retryPending} style={{ ...btn.primary, padding: "0.45rem 1rem", fontSize: "0.85rem" }}>Sync Now</button>
        </div>
      )}

      {/* ── Job Offers ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "#374151" }}>
          Job Offers <span style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 400 }}>({offered.length})</span>
        </h2>

        {offered.length === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: "1.5rem 0", fontSize: "0.9rem" }}>No pending offers.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {offered.map((a) => (
              <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "1.25rem 1.5rem", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <strong style={{ color: "#1976d2" }}>{a.job_title}</strong>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#6b7280" }}>Offered</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => runAction(acceptAssignment, a.id)} style={btn.success}>Accept</button>
                  <button onClick={() => runAction(declineAssignment, a.id)} style={btn.danger}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Active Jobs ────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "#374151" }}>
          Active Jobs <span style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 400 }}>({active.length})</span>
        </h2>

        {active.length === 0 ? (
          <p style={{ color: "#9ca3af", textAlign: "center", padding: "1.5rem 0", fontSize: "0.9rem" }}>No active jobs.</p>
        ) : (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {active.map((a) => (
              <article key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: "14px", padding: "1.5rem", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1rem", color: "#1976d2" }}>{a.job_title}</strong>
                  <span style={{ padding: "0.3rem 0.85rem", background: "#e0f2fe", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 600, color: "#0369a1" }}>{a.status}</span>
                </div>

                {/* Lifecycle actions */}
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                  {a.status === "accepted" && (
                    <button onClick={() => runAction(startAssignment, a.id)} style={btn.primary}>Mark Started</button>
                  )}
                  {a.status === "active" && (
                    <button onClick={() => runAction(completeAssignment, a.id)} style={btn.success}>Mark Completed</button>
                  )}
                  <button
                    onClick={() => setActiveDayId((prev) => (prev === a.id ? null : a.id))}
                    style={{ ...btn.primary, background: activeDayId === a.id ? "#1565c0" : "#4dabf7" }}
                  >
                    {activeDayId === a.id ? "Close Log Panel" : "Start Day / Log"}
                  </button>
                </div>

                {/* Day log panel */}
                {activeDayId === a.id && (
                  <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "1.25rem", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
                    <p style={{ margin: "0 0 0.85rem", fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>Quick Day Log</p>

                    <textarea
                      rows={3}
                      placeholder="What was completed today?"
                      value={draft.work_completed}
                      onChange={(e) => setDraft((d) => ({ ...d, work_completed: e.target.value }))}
                      style={fieldStyle}
                    />
                    <textarea
                      rows={2}
                      placeholder="Any issues or blockers? (optional)"
                      value={draft.issues_blockers}
                      onChange={(e) => setDraft((d) => ({ ...d, issues_blockers: e.target.value }))}
                      style={fieldStyle}
                    />

                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button onClick={handleVoiceDraft} style={{ ...btn.primary, background: "#7c3aed" }}>AI Draft</button>
                      <button onClick={handleSubmitVoice} style={btn.success}>Submit Log</button>
                    </div>
                  </div>
                )}

                {/* Detailed form log */}
                <details style={{ marginBottom: "0.75rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#6b7280", padding: "0.5rem 0" }}>
                    Detailed form log
                  </summary>
                  <form onSubmit={(e) => handleFormLog(a.id, e)} style={{ paddingTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <input
                        type="date"
                        value={getLogForm(a.id).logDate}
                        onChange={(e) => setField(a.id, "logDate", e.target.value)}
                        required
                        style={fieldStyle}
                      />
                      <input
                        type="number"
                        min="0" max="24" step="0.25"
                        placeholder="Hours worked"
                        value={getLogForm(a.id).hoursWorked}
                        onChange={(e) => setField(a.id, "hoursWorked", e.target.value)}
                        required
                        style={fieldStyle}
                      />
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Work summary"
                      value={getLogForm(a.id).workSummary}
                      onChange={(e) => setField(a.id, "workSummary", e.target.value)}
                      required
                      style={{ ...fieldStyle, resize: "vertical" }}
                    />
                    <textarea
                      rows={2}
                      placeholder="Issues (optional)"
                      value={getLogForm(a.id).issues}
                      onChange={(e) => setField(a.id, "issues", e.target.value)}
                      style={{ ...fieldStyle, resize: "vertical" }}
                    />
                    <button type="submit" style={btn.primary}>Submit Detailed Log</button>
                  </form>
                </details>

                {/* Recent logs summary */}
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#6b7280", padding: "0.5rem 0" }}>
                    Recent logs ({(logsByAssignment[a.id] ?? []).length})
                  </summary>
                  <div style={{ marginTop: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
                    {(logsByAssignment[a.id] ?? []).length === 0 ? (
                      <p style={{ fontSize: "0.82rem", color: "#9ca3af" }}>No logs yet.</p>
                    ) : (
                      (logsByAssignment[a.id] ?? []).slice(0, 8).map((log) => (
                        <div key={log.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f3f4f6", fontSize: "0.82rem" }}>
                          <strong>{log.log_date}:</strong> {log.hours_worked}h — {log.work_summary}
                          {log.issues && <span style={{ color: "#dc2626", marginLeft: "0.5rem" }}>⚠ {log.issues}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </details>

              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Completed Jobs ─────────────────────────────────────────────────────── */}
      {completed.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", color: "#374151" }}>
            Completed <span style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 400 }}>({completed.length})</span>
          </h2>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {completed.map((a) => (
              <div key={a.id} style={{ padding: "0.85rem 1.2rem", border: "1px solid #d1fae5", borderRadius: "8px", background: "#f0fdf4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem" }}>{a.job_title}</strong>
                <span style={{ fontSize: "0.8rem", color: "#15803d", fontWeight: 600 }}>Completed</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
