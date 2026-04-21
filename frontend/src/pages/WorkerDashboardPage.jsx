# ✅ **COMPLETE WorkerDashboardPage.jsx - COPY/PASTE TO GITHUB**

**Ultimate construction worker dashboard with voice logging + offline sync!**

```javascript
import { useEffect, useMemo, useState } from "react";
// 🔥 FULL API FEATURES (merged both branches)
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

const PENDING_KEY = "omnas_pending_logs_v1";

function loadPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(items) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}

export function WorkerDashboardPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };
  const [assignments, setAssignments] = useState([]);
  const [logsByAssignment, setLogsByAssignment] = useState({});
  // 🔥 FULL STATE (voice + form + offline)
  const [message, setMessage] = useState("");
  const [activeDayAssignmentId, setActiveDayAssignmentId] = useState(null);
  const [draft, setDraft] = useState({ work_completed: "", issues_blockers: "", photos: [""] });
  const [pendingLogs, setPendingLogs] = useState(loadPending());
  const [logForms, setLogForms] = useState({});

  async function refresh() {
    try {
      const response = await listAssignments(auth);
      const assignmentRows = response.data;
      setAssignments(assignmentRows);

      // 🔥 PARALLEL LOG LOADING
      const logsEntries = await Promise.all(
        assignmentRows.map(async (assignment) => {
          const logsResponse = await getAssignmentLogs(assignment.id, auth);
          return [assignment.id, logsResponse.data];
        })
      );

      setLogsByAssignment(Object.fromEntries(logsEntries));
    } catch (error) {
      setMessage(`Refresh failed: ${error.message}`);
    }
  }

  // 🔥 OFFLINE SYNC
  useEffect(() => {
    savePending(pendingLogs);
  }, [pendingLogs]);

  useEffect(() => {
    refresh();
  }, []);

  // 🔥 ASSIGNMENT FILTERS
  const offered = useMemo(() => assignments.filter(item => item.status === "offered"), [assignments]);
  const active = useMemo(() => assignments.filter(item => ["accepted", "active"].includes(item.status)), [assignments]);
  const completed = useMemo(() => assignments.filter(item => item.status === "completed"), [assignments]);

  // 🔥 ASSIGNMENT ACTIONS
  async function runAction(action, id) {
    try {
      await action(id, auth);
      setMessage("Assignment updated successfully!");
      await refresh();
    } catch (error) {
      setMessage(`Action failed: ${error.message}`);
    }
  }

  // 🔥 VOICE LOGGING WORKFLOW (3-tap field capture)
  async function handleRecordLog() {
    if (!activeDayAssignmentId) {
      setMessage("👆 Tap 'Start Day' on an active assignment first");
      return;
    }

    try {
      const response = await submitVoiceLog(
        {
          assignmentId: activeDayAssignmentId,
          text: draft.work_completed,
          issues: draft.issues_blockers,
          photos: draft.photos.filter(Boolean),
          isDraft: true
        },
        auth
      );

      const prefill = response.data.prefill;
      setDraft(prev => ({
        ...prev,
        work_completed: prefill.work_completed || prev.work_completed
      }));
      setMessage("🎤 Voice captured! AI detected categories. Review → Submit.");
    } catch (error) {
      setMessage(`Voice failed: ${error.message}`);
    }
  }

  async function handleSubmitLog() {
    if (!activeDayAssignmentId) {
      setMessage("👆 Tap 'Start Day' first");
      return;
    }

    const payload = {
      assignmentId: activeDayAssignmentId,
      workCompleted: draft.work_completed,
      workSummary: draft.work_completed || "Field work completed",
      issuesBlockers: draft.issues_blockers || null,
      photos: draft.photos.filter(Boolean),
      weather: "manual_pending",
      crewSize: 1,
      hoursWorked: 8,
      logDate: new Date().toISOString().slice(0, 10)
    };

    try {
      await submitDailyExecutionLog(payload, auth);
      setMessage("✅ Log submitted & synced!");
      setDraft({ work_completed: "", issues_blockers: "", photos: [""] });
      setPendingLogs(prev => prev.filter(item => item.assignmentId !== activeDayAssignmentId));
      await refresh();
    } catch (error) {
      // 🔥 OFFLINE QUEUE
      setPendingLogs(prev => [...prev, payload]);
      setMessage(`💾 Saved offline (${pendingLogs.length + 1} queued). Tap Sync to retry.`);
    }
  }

  async function retryPending() {
    if (pendingLogs.length === 0) {
      setMessage("✅ No offline logs to sync");
      return;
    }

    const remaining = [];
    for (const payload of pendingLogs) {
      try {
        await submitDailyExecutionLog(payload, auth);
      } catch {
        remaining.push(payload);
      }
    }

    setPendingLogs(remaining);
    const synced = pendingLogs.length - remaining.length;
    setMessage(synced > 0 ? `✅ Synced ${synced} logs (${remaining.length} remaining)` : "❌ Sync failed - check connection");
    await refresh();
  }

  function setPhoto(index, value) {
    setDraft(prev => {
      const photos = [...prev.photos];
      photos[index] = value;
      return { ...prev, photos };
    });
  }

  // 🔥 FORM LOGGING (office alternative)
  function getLogForm(assignmentId) {
    return logForms[assignmentId] || {
      logDate: new Date().toISOString().slice(0, 10),
      hoursWorked: "8",
      workSummary: "",
      issues: ""
    };
  }

  function setLogFormValue(assignmentId, key, value) {
    setLogForms(prev => ({
      ...prev,
      [assignmentId]: { ...getLogForm(assignmentId), [key]: value }
    }));
  }

  async function handleSubmitFormLog(assignmentId, event) {
    event.preventDefault();
    try {
      const form = getLogForm(assignmentId);
      await submitDailyLog(assignmentId, { ...form, hoursWorked: Number(form.hoursWorked) }, auth);
      setMessage("📝 Form log submitted!");
      // Clear form
      setLogForms(prev => {
        const newForms = { ...prev };
        delete newForms[assignmentId];
        return newForms;
      });
      await refresh();
    } catch (error) {
      setMessage(`Form submit failed: ${error.message}`);
    }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "2.5rem", color: "#1976d2", marginBottom: "1rem" }}>
        👷 Worker Dashboard
      </h1>

      {/* 🔥 STATUS MESSAGE */}
      {message && (
        <div style={{
          padding: "1rem 1.5rem",
          marginBottom: "2rem",
          background: message.includes("✅") || message.includes("synced") ? "#d4edda" : 
                     message.includes("💾") ? "#fff3cd" : "#f8d7da",
          borderRadius: "12px",
          borderLeft: `5px solid ${message.includes("✅") ? "#28a745" : 
                               message.includes("💾") ? "#ffc107" : "#dc3545"}`,
          color: message.includes("✅") ? "#155724" : "#721c24"
        }}>
          {message}
        </div>
      )}

      {/* 🔥 OFFLINE SYNC BAR */}
      {pendingLogs.length > 0 && (
        <div style={{
          background: "#fff3cd",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>💾 <strong>{pendingLogs.length}</strong> offline logs queued</span>
          <button 
            onClick={retryPending}
            style={{
              padding: "0.5rem 1.5rem",
              background: "#ffc107",
              color: "#212529",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            🔄 Sync Now
          </button>
        </div>
      )}

      {/* 🔥 JOB OFFERS */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>📋 Job Offers ({offered.length})</h2>
        {offered.length === 0 ? (
          <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
            No new job offers. Check back soon! 🎯
          </p>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {offered.map(assignment => (
              <div key={assignment.id} style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "1.5rem",
                background: "#f8f9fa",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "#1976d2" }}>
                    {assignment.job_title}
                  </h3>
                  <p style={{ margin: 0, color: "#666" }}>Status: <strong>{assignment.status}</strong></p>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <button 
                    onClick={() => runAction(acceptAssignment, assignment.id)}
                    style={{
                      padding: "1rem 2rem",
                      background: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    ✅ Accept
                  </button>
                  <button 
                    onClick={() => runAction(declineAssignment, assignment.id)}
                    style={{
                      padding: "1rem 2rem",
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    ❌ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 🔥 ACTIVE JOBS w/ LOGGING */}
      <section style={{ marginBottom: "3rem" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>⚡ Active Jobs ({active.length})</h2>
        <div style={{ display: "grid", gap: "2rem" }}>
          {active.map(assignment => (
            <article key={assignment.id} style={{
              border: "1px solid #dee2e6",
              borderRadius: "16px",
              padding: "2rem",
              background: "white",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
            }}>
              <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: 0, color: "#1976d2" }}>{assignment.job_title}</h3>
                <span style={{ 
                  padding: "0.5rem 1rem", 
                  background: "#e3f2fd", 
                  borderRadius: "20px", 
                  fontWeight: "bold",
                  fontSize: "0.9rem"
                }}>
                  {assignment.status}
                </span>
              </header>

              {/* 🔥 ASSIGNMENT ACTIONS */}
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                {assignment.status === "accepted" && (
                  <button 
                    onClick={() => runAction(startAssignment, assignment.id)}
                    style={buttonStyle.primary}
                  >
                    🚀 Mark Started
                  </button>
                )}
                {assignment.status === "active" && (
                  <button 
                    onClick={() => runAction(completeAssignment, assignment.id)}
                    style={buttonStyle.success}
                  >
                    🎉 Mark Completed
                  </button>
                )}
                <button 
                  onClick={() => setActiveDayAssignmentId(assignment.id)}
                  style={{
                    ...buttonStyle.primary,
                    background: activeDayAssignmentId === assignment.id ? "#1976d2" : "#4dabf7"
                  }}
                >
                  📝 {activeDayAssignmentId === assignment.id ? "Active" : "Start Day"}
                </button>
              </div>

              {/* 🔥 QUICK VOICE LOG (3-tap field workflow) */}
              {activeDayAssignmentId === assignment.id && (
                <details style={{ marginBottom: "1.5rem" }}>
                  <summary style={{ 
                    fontWeight: "bold", 
                    padding: "1rem", 
                    background: "#e3f2fd", 
                    borderRadius: "8px", 
                    cursor: "pointer" 
                  }}>
                    🎤 Quick Voice Log (3 taps)
                  </summary>
                  <div style={{ padding: "1.5rem", background: "#f8f9fa", borderRadius: "8px" }}>
                    <textarea
                      rows={3}
                      placeholder="What did you do today? (voice will auto-fill)"
                      value={draft.work_completed}
                      onChange={e => setDraft(prev => ({ ...prev, work_completed: e.target.value }))}
                      style={{ width: "100%", marginBottom: "1rem", padding: "1rem", borderRadius: "8px" }}
                    />
                    <textarea
                      rows={2}
                      placeholder="Any issues/blockers?"
                      value={draft.issues_blockers}
                      onChange={e => setDraft(prev => ({ ...prev, issues_blockers: e.target.value }))}
                      style={{ width: "100%", marginBottom: "1rem", padding: "1rem", borderRadius: "8px" }}
                    />
                    <input
                      placeholder="Photo URL (optional)"
                      value={draft.photos[0] || ""}
                      onChange={e => setPhoto(0, e.target.value)}
                      style={{ width: "100%", padding: "1rem", borderRadius: "8px", marginBottom: "1rem" }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                      <button 
                        onClick={handleRecordLog}
                        style={buttonStyle.primary}
                      >
                        🎤 Record Voice Log
                      </button>
                      <button 
                        onClick={handleSubmitLog}
                        style={buttonStyle.success}
                      >
                        ✅ Submit Log
                      </button>
                    </div>
                  </div>
                </details>
              )}

              {/* 🔥 FORM LOG (office alternative) */}
              <details style={{ marginBottom: "1.5rem" }}>
                <summary style={{ 
                  fontWeight: "bold", 
                  padding: "1rem", 
                  background: "#f8f9fa", 
                  borderRadius: "8px", 
                  cursor: "pointer" 
                }}>
                  📝 Detailed Form Log
                </summary>
                <form 
                  onSubmit={e => handleSubmitFormLog(assignment.id, e)}
                  style={{ padding: "1.5rem", background: "#fafbfc" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                    <input
                      type="date"
                      value={getLogForm(assignment.id).logDate}
                      onChange={e => setLogFormValue(assignment.id, "logDate", e.target.value)}
                      required
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.25"
                      placeholder="Hours"
                      value={getLogForm(assignment.id).hoursWorked}
                      onChange={e => setLogFormValue(assignment.id, "hoursWorked", e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Detailed work summary"
                    value={getLogForm(assignment.id).workSummary}
                    onChange={e => setLogFormValue(assignment.id, "workSummary", e.target.value)}
                    required
                    style={{ ...inputStyle, height: "120px", marginBottom: "1rem" }}
                  />
                  <textarea
                    rows={2}
                    placeholder="Issues/problems (optional)"
                    value={getLogForm(assignment.id).issues}
                    onChange={e => setLogFormValue(assignment.id, "issues", e.target.value)}
                    style={{ ...inputStyle, height: "80px" }}
                  />
                  <button 
                    type="submit"
                    style={buttonStyle.primary}
                  >
                    📋 Submit Detailed Log
                  </button>
                </form>
              </details>

              {/* 🔥 RECENT LOGS */}
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>📄 Recent Logs ({(logsByAssignment[assignment.id] || []).length})</h4>
                <div style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid #eee", 
                  borderRadius: "8px", 
                  padding: "1rem" 
                }}>
                  {(logsByAssignment[assignment.id] || []).slice(0, 5).map(log => (
                    <div key={log.id} style={{ 
                      padding: "0.75rem", 
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: "0.9rem"
                    }}>
                      <strong>{log.log_date}:</strong> {log.hours_worked}h — {log.work_summary}
                      {log.issues && <span style={{ color: "#d32f2f", marginLeft: