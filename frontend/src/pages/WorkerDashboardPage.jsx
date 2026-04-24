import { useEffect, useMemo, useState } from "react";
import {
  acceptAssignment,
  completeAssignment,
  declineAssignment,
  getAssignmentLogs,
  listAssignments,
  startAssignment,
  submitDailyExecutionLog,
  submitVoiceLog
} from "../services/api.js";
import { useAuth } from "../auth/auth-context.jsx";

function getPendingKey(userId) {
  return `omnas_pending_logs_${userId || "anon"}_v1`;
}

function loadPending(userId) {
  try {
    const raw = localStorage.getItem(getPendingKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(userId, items) {
  localStorage.setItem(getPendingKey(userId), JSON.stringify(items));
}

export function WorkerDashboardPage() {
  const { authHeaders: auth } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [logsByAssignment, setLogsByAssignment] = useState({});
  const [message, setMessage] = useState("");
  const [activeDayAssignmentId, setActiveDayAssignmentId] = useState(null);
  const [draft, setDraft] = useState({ work_completed: "", issues_blockers: "", photos: [""] });
  const [pendingLogs, setPendingLogs] = useState(() => loadPending(auth?.userId));

  async function refresh() {
    try {
      const response = await listAssignments(auth);
      const assignmentRows = response.data;
      setAssignments(assignmentRows);

      const logsEntries = await Promise.all(
        assignmentRows.map(async (assignment) => {
          const logsResponse = await getAssignmentLogs(assignment.id, auth);
          return [assignment.id, logsResponse.data];
        })
      );

      setLogsByAssignment(Object.fromEntries(logsEntries));
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    savePending(auth?.userId, pendingLogs);
  }, [auth?.userId, pendingLogs]);

  useEffect(() => {
    setPendingLogs(loadPending(auth?.userId));
  }, [auth?.userId]);

  const offered = useMemo(() => assignments.filter((item) => item.status === "offered"), [assignments]);
  const active = useMemo(() => assignments.filter((item) => ["accepted", "active"].includes(item.status)), [assignments]);
  const completed = useMemo(() => assignments.filter((item) => item.status === "completed"), [assignments]);

  async function runAction(action, id) {
    try {
      await action(id, auth);
      setMessage("Assignment updated.");
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRecordLog() {
    if (!activeDayAssignmentId) {
      setMessage("Tap Start Day on an active assignment first.");
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
      setDraft((prev) => ({
        ...prev,
        work_completed: prefill.work_completed || prev.work_completed
      }));
      setMessage("Voice-to-log captured. Review and tap Submit Log.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSubmitLog() {
    if (!activeDayAssignmentId) {
      setMessage("Tap Start Day first.");
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
      setMessage("Day log submitted.");
      setDraft({ work_completed: "", issues_blockers: "", photos: [""] });
      setPendingLogs((prev) => prev.filter((item) => item.assignmentId !== activeDayAssignmentId));
      await refresh();
    } catch (error) {
      setPendingLogs((prev) => [...prev, payload]);
      setMessage("Offline save: log queued locally and will retry when you tap Submit Log again.");
    }
  }

  async function retryPending() {
    if (pendingLogs.length === 0) {
      setMessage("No queued logs.");
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
    setMessage(remaining.length === 0 ? "Queued logs synced." : `${remaining.length} logs still queued.`);
    await refresh();
  }

  function setPhoto(index, value) {
    setDraft((prev) => {
      const photos = [...prev.photos];
      photos[index] = value;
      return { ...prev, photos };
    });
  }

  return (
    <>
      <h1>Worker Dashboard</h1>

      <h2>Job Offers</h2>
      <ul>
        {offered.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong>
            <button type="button" onClick={() => runAction(acceptAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
              Accept
            </button>
            <button type="button" onClick={() => runAction(declineAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
              Decline
            </button>
          </li>
        ))}
      </ul>

      <h2>Field Execution (3 taps)</h2>
      <p className="message">1) Start Day → 2) Record Log → 3) Submit Log</p>

      {active.map((assignment) => (
        <article key={assignment.id} className="analysis-card">
          <h3>{assignment.job_title}</h3>
          <p>Status: {assignment.status}</p>
          {assignment.status === "accepted" ? (
            <button type="button" onClick={() => runAction(startAssignment, assignment.id)}>
              Mark Started
            </button>
          ) : null}
          {assignment.status === "active" ? (
            <button type="button" onClick={() => runAction(completeAssignment, assignment.id)}>
              Mark Completed
            </button>
          ) : null}
          <button type="button" onClick={() => setActiveDayAssignmentId(assignment.id)}>
            Start Day
          </button>
        </article>
      ))}

      <section className="analysis-card">
        <h3>Daily Log Capture</h3>
        <p>Current assignment: {activeDayAssignmentId || "Not selected"}</p>
        <textarea
          rows={3}
          placeholder="What did you do today?"
          value={draft.work_completed}
          onChange={(event) => setDraft((prev) => ({ ...prev, work_completed: event.target.value }))}
        />
        <textarea
          rows={2}
          placeholder="Any problems?"
          value={draft.issues_blockers}
          onChange={(event) => setDraft((prev) => ({ ...prev, issues_blockers: event.target.value }))}
        />
        <input
          placeholder="Photo URL"
          value={draft.photos[0] || ""}
          onChange={(event) => setPhoto(0, event.target.value)}
        />

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <button type="button" onClick={handleRecordLog} style={{ fontSize: "1.15rem", padding: "1rem" }}>
            🎤 Record Log
          </button>
          <button type="button" onClick={handleSubmitLog} style={{ fontSize: "1.15rem", padding: "1rem" }}>
            ✅ Submit Log
          </button>
          <button type="button" onClick={retryPending}>
            Sync Offline Logs ({pendingLogs.length})
          </button>
        </div>
      </section>

      <h2>Completed</h2>
      <ul>
        {completed.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong>
            <ul>
              {(logsByAssignment[assignment.id] || []).map((log) => (
                <li key={log.id}>
                  {log.log_date}: {log.work_completed || log.work_summary}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
