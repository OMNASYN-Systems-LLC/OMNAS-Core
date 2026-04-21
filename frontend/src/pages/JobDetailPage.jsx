import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getJob, getJobCommand } from "../services/api.js";
import { CommandTab } from "../components/CommandTab.jsx";

const CONTRACTOR_AUTH = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
const CLIENT_AUTH = { userId: "00000000-0000-0000-0000-000000000003", role: "client" };

export function JobDetailPage() {
  const { jobId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = searchParams.get("role") === "client" ? "client" : "contractor";
  const auth = role === "client" ? CLIENT_AUTH : CONTRACTOR_AUTH;

  const [activeTab, setActiveTab] = useState("command");
  const [job, setJob] = useState(null);
  const [command, setCommand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [jobResponse, commandResponse] = await Promise.all([
          getJob(jobId, auth).catch(() => null),
          getJobCommand(jobId, auth)
        ]);
        if (cancelled) return;
        setJob(jobResponse?.data ?? null);
        setCommand(commandResponse?.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load command data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId, role]);

  function switchRole(next) {
    const params = new URLSearchParams(searchParams);
    if (next === "client") params.set("role", "client");
    else params.delete("role");
    setSearchParams(params, { replace: true });
  }

  return (
    <>
      <nav className="job-detail-nav">
        <Link to="/contractor-dashboard">← Dashboard</Link>
      </nav>

      <div className="job-detail-header">
        <h1>{job?.title ?? command?.job?.title ?? `Job #${jobId}`}</h1>
        <div className="role-switch" role="group" aria-label="View as">
          <button
            type="button"
            className={`role-switch-btn ${role === "contractor" ? "is-active" : ""}`}
            onClick={() => switchRole("contractor")}
          >
            Contractor
          </button>
          <button
            type="button"
            className={`role-switch-btn ${role === "client" ? "is-active" : ""}`}
            onClick={() => switchRole("client")}
          >
            Client
          </button>
        </div>
      </div>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "command"}
          className={`tab ${activeTab === "command" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("command")}
        >
          COMMAND
        </button>
        <Link to={`/job-matches/${jobId}`} className="tab tab-link">
          MATCHES
        </Link>
      </div>

      {loading ? <p className="message">Loading command data…</p> : null}
      {error ? <p className="message message-error">{error}</p> : null}

      {!loading && !error && activeTab === "command" && command ? (
        <CommandTab command={command} role={role} />
      ) : null}
    </>
  );
}
