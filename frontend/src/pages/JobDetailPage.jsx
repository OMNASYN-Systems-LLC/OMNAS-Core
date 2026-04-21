import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, getJobCommand } from "../services/api.js";
import { CommandTab } from "../components/CommandTab.jsx";

const DEFAULT_AUTH = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };

export function JobDetailPage() {
  const { jobId } = useParams();
  const auth = DEFAULT_AUTH;
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
        if (!cancelled) setError(err.message || "Failed to load job command data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <>
      <nav className="job-detail-nav">
        <Link to="/contractor-dashboard">← Dashboard</Link>
      </nav>

      <h1>{job?.title ?? `Job #${jobId}`}</h1>

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

      {activeTab === "command" && command ? (
        <CommandTab command={command} jobId={jobId} role={auth.role} />
      ) : null}
    </>
  );
}
