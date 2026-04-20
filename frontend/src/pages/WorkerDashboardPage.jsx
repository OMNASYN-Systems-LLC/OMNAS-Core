import { useEffect, useMemo, useState } from "react";
import { acceptAssignment, completeAssignment, declineAssignment, listAssignments, startAssignment } from "../services/api.js";

export function WorkerDashboardPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const response = await listAssignments(auth);
      setAssignments(response.data);
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
          </li>
        ))}
      </ul>

      <h2>Completed</h2>
      <ul>
        {completed.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.job_title}</strong> — status: {assignment.status}
          </li>
        ))}
      </ul>

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
