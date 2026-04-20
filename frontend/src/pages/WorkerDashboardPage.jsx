import { useEffect, useMemo, useState } from "react";
import {
  acceptAssignment,
  completeAssignment,
  declineAssignment,
  getAssignmentLogs,
  listAssignments,
  startAssignment,
  submitDailyLog
} from "../services/api.js";

export function WorkerDashboardPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };
  const [assignments, setAssignments] = useState([]);
  const [logsByAssignment, setLogsByAssignment] = useState({});
  const [logForms, setLogForms] = useState({});
  const [message, setMessage] = useState("");

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

  function getLogForm(assignmentId) {
    return (
      logForms[assignmentId] || {
        logDate: new Date().toISOString().slice(0, 10),
        hoursWorked: "8",
        workSummary: "",
        issues: ""
      }
    );
  }

  function setLogFormValue(assignmentId, key, value) {
    setLogForms((prev) => ({
      ...prev,
      [assignmentId]: {
        ...getLogForm(assignmentId),
        [key]: value
      }
    }));
  }

  async function handleSubmitLog(assignmentId, event) {
    event.preventDefault();

    try {
      const form = getLogForm(assignmentId);
      await submitDailyLog(
        assignmentId,
        {
          ...form,
          hoursWorked: Number(form.hoursWorked)
        },
        auth
      );
      setMessage("Daily log submitted.");
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Worker Dashboard</h1>

      <h2>Job Offers</h2>
      <ul>
        {offered.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong> — status: {assignment.status}
            <button type="button" onClick={() => runAction(acceptAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
              Accept
            </button>
            <button type="button" onClick={() => runAction(declineAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
              Decline
            </button>
          </li>
        ))}
      </ul>

      <h2>Active Jobs</h2>
      <ul>
        {active.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong> — status: {assignment.status}
            {assignment.status === "accepted" ? (
              <button type="button" onClick={() => runAction(startAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
                Mark Started
              </button>
            ) : null}
            {assignment.status === "active" ? (
              <button type="button" onClick={() => runAction(completeAssignment, assignment.id)} style={{ marginLeft: "0.5rem" }}>
                Mark Completed
              </button>
            ) : null}

            <details style={{ marginTop: "0.5rem" }}>
              <summary>Submit Daily Log</summary>
              <form onSubmit={(event) => handleSubmitLog(assignment.id, event)}>
                <input
                  type="date"
                  value={getLogForm(assignment.id).logDate}
                  onChange={(event) => setLogFormValue(assignment.id, "logDate", event.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.25"
                  value={getLogForm(assignment.id).hoursWorked}
                  onChange={(event) => setLogFormValue(assignment.id, "hoursWorked", event.target.value)}
                  required
                />
                <textarea
                  rows={3}
                  placeholder="Work summary"
                  value={getLogForm(assignment.id).workSummary}
                  onChange={(event) => setLogFormValue(assignment.id, "workSummary", event.target.value)}
                  required
                />
                <textarea
                  rows={2}
                  placeholder="Issues (optional)"
                  value={getLogForm(assignment.id).issues}
                  onChange={(event) => setLogFormValue(assignment.id, "issues", event.target.value)}
                />
                <button type="submit">Submit Daily Log</button>
              </form>
            </details>

            <div style={{ marginTop: "0.5rem" }}>
              <strong>Logs</strong>
              <ul>
                {(logsByAssignment[assignment.id] || []).map((log) => (
                  <li key={log.id}>
                    {log.log_date}: {log.hours_worked}h — {log.work_summary}
                    {log.issues ? ` | Issues: ${log.issues}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <h2>Completed</h2>
      <ul>
        {completed.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong> — status: {assignment.status}
            <ul>
              {(logsByAssignment[assignment.id] || []).map((log) => (
                <li key={log.id}>
                  {log.log_date}: {log.hours_worked}h — {log.work_summary}
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
