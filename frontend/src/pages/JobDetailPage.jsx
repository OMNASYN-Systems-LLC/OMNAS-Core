import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { createAssignment, getJobDashboard } from "../services/api.js";
import { CommandTab } from "../components/CommandTab.jsx";

const CONTRACTOR_AUTH = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
const CLIENT_AUTH = { userId: "00000000-0000-0000-0000-000000000003", role: "client" };

export function JobDetailPage() {
  const { jobId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get("role") === "client" ? "client" : "contractor";
  const auth = role === "client" ? CLIENT_AUTH : CONTRACTOR_AUTH;

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await getJobDashboard(jobId, auth);
        if (!cancelled) {
          setDashboard(response?.data ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [jobId, role]);

  function switchRole(nextRole) {
    const params = new URLSearchParams(searchParams);
    if (nextRole === "client") {
      params.set("role", "client");
    } else {
      params.delete("role");
    }
    setSearchParams(params, { replace: true });
  }

  async function handleAssign(workerId) {
    try {
      await createAssignment({ jobId: Number(jobId), workerUserId: workerId }, auth);
      setMessage("Assignment offer sent to worker!");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#666" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏗️</div>
        <h2>Loading Dashboard...</h2>
        <p>Aggregating jobs, assignments, logs, and matches</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#d32f2f" }}>
        <h2>Failed to load dashboard</h2>
        <p>{error}</p>
        <Link to="/contractor-dashboard" style={{ color: "#1976d2" }}>
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const job = dashboard?.job;

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 1rem" }}>
      {/* Header */}
      <nav style={{ padding: "1rem 0", marginBottom: "2rem", borderBottom: "1px solid #eee" }}>
        <Link
          to="/contractor-dashboard"
          style={{
            color: "#1976d2",
            textDecoration: "none",
            fontWeight: "bold",
            padding: "0.75rem 1.5rem",
            background: "#e3f2fd",
            borderRadius: "8px",
          }}
        >
          ← Back to Dashboard
        </Link>
      </nav>

      {/* Job title + status */}
      {job && (
        <header style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{job.title}</h1>
            <span
              style={{
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                background: job.status === "open" ? "#e8f5e8" : "#f3f4f6",
                color: job.status === "open" ? "#388e3c" : "#666",
                fontWeight: "bold",
                fontSize: "0.85rem",
                textTransform: "uppercase",
              }}
            >
              {job.status}
            </span>
          </div>
          {job.startsAt && job.endsAt && (
            <p style={{ color: "#666", margin: "0.5rem 0 0" }}>
              {new Date(job.startsAt).toLocaleDateString()} –{" "}
              {new Date(job.endsAt).toLocaleDateString()}
              {job.payRate ? ` · $${job.payRate}/hr` : ""}
            </p>
          )}
        </header>
      )}

      {/* Role switcher */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => switchRole("contractor")}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: role === "contractor" ? "#1976d2" : "#e3f2fd",
            color: role === "contractor" ? "white" : "#1976d2",
            fontWeight: "bold",
          }}
        >
          Contractor View
        </button>
        <button
          type="button"
          onClick={() => switchRole("client")}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: role === "client" ? "#1976d2" : "#e3f2fd",
            color: role === "client" ? "white" : "#1976d2",
            fontWeight: "bold",
          }}
        >
          Client View
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "6px",
            background: message.startsWith("Error") ? "#fdecea" : "#e8f5e8",
            color: message.startsWith("Error") ? "#d32f2f" : "#388e3c",
          }}
        >
          {message}
        </div>
      )}

      {/* Dashboard */}
      <CommandTab dashboard={dashboard} role={role} />

      {/* Quick actions */}
      {role === "contractor" && dashboard && (
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "2rem",
            padding: "1.5rem",
            background: "#f8f9fa",
            borderRadius: "12px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to={`/job-matches/${jobId}`}
            style={{
              padding: "1rem 2rem",
              background: "#388e3c",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold",
            }}
          >
            View Worker Matches ({dashboard.matchPool?.totalMatches ?? 0})
          </Link>
          {dashboard.action?.some((a) => ["high", "critical"].includes(a.priority)) && (
            <span
              style={{
                padding: "1rem 2rem",
                background: "#ff9800",
                color: "white",
                borderRadius: "8px",
                fontWeight: "bold",
              }}
            >
              {dashboard.action.filter((a) => ["high", "critical"].includes(a.priority)).length} action(s) need attention
            </span>
          )}
        </div>
      )}
    </div>
  );
}
