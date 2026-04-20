import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createAssignment, getJob, getJobRecommendations, getJobSchedule } from "../services/api.js";

export function JobDetailPage() {
  const { jobId } = useParams();
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [activeTab, setActiveTab] = useState("recommendations");
  const [job, setJob] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [message, setMessage] = useState("");
  const [appliedAdjustment, setAppliedAdjustment] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [jobResponse, recommendationResponse, scheduleResponse] = await Promise.all([
          getJob(jobId, auth),
          getJobRecommendations(jobId, auth),
          getJobSchedule(jobId, auth)
        ]);

        setJob(jobResponse.data);
        setRecommendations(recommendationResponse.data.gapRecommendations || []);
        setSchedule(scheduleResponse.data);
      } catch (error) {
        setMessage(error.message);
      }
    }

    load();
  }, [jobId]);

  const readinessClass = useMemo(() => {
    if (!schedule?.readinessStatus) {
      return "severity-medium";
    }

    if (schedule.readinessStatus === "READY") {
      return "severity-low";
    }

    if (schedule.readinessStatus === "AT_RISK") {
      return "severity-medium";
    }

    return "severity-high";
  }, [schedule]);

  async function handleAssign(workerId) {
    try {
      await createAssignment({ jobId: Number(jobId), workerUserId: workerId }, auth);
      setMessage("Assignment offer sent.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function statusDot(status) {
    if (status === "GREEN") return "🟢";
    if (status === "YELLOW") return "🟡";
    return "🔴";
  }


  function renderWeekList(lookaheadSource) {
    return (
      <div className="gantt-grid">
        <div className="gantt-row">
          <strong>Week 1</strong>
          <div className="gantt-bar week1">{(lookaheadSource?.week1 || []).map((item) => item.category).join(", ") || "No planned trades"}</div>
        </div>
        <div className="gantt-row">
          <strong>Week 2</strong>
          <div className="gantt-bar week2">{(lookaheadSource?.week2 || []).map((item) => item.category).join(", ") || "No planned trades"}</div>
        </div>
        <div className="gantt-row">
          <strong>Week 3</strong>
          <div className="gantt-bar week3">{(lookaheadSource?.week3 || []).map((item) => item.category).join(", ") || "No planned trades"}</div>
        </div>
      </div>
    );
  }

  function renderRecommendations() {
    return (
      <section>
        <h2>Recommendations</h2>
        {recommendations.length === 0 ? <p className="message">No recommendation gaps detected.</p> : null}

        {recommendations.map((gap) => (
          <article key={gap.category} className={`analysis-card severity-${gap.severity}`}>
            <h3>
              {gap.category} ({gap.severity})
            </h3>

            <ul>
              {gap.topRecommendations.map((item) => (
                <li key={item.workerId}>
                  <strong>{item.workerName}</strong>
                  {item.bestFitForGap ? <span> ✅ Best Fit</span> : null}
                  <br />
                  Fit Score: {item.fitScore}%
                  <br />
                  Trade Fit Type: {item.tradeFitType}
                  <br />
                  Compliance: {item.complianceStatus} {item.requiresLicensedTrade ? "(licensed trade required)" : ""}
                  <br />
                  Rationale: skill {item.rationale.skill}, reliability {item.rationale.reliability}, availability {item.rationale.availability}, proximity {item.rationale.proximity}, experience {item.rationale.experience}
                  <br />
                  <button type="button" onClick={() => handleAssign(item.workerId)}>
                    Assign Worker
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    );
  }

  function renderSchedule() {
    if (!schedule) {
      return <p className="message">Schedule unavailable.</p>;
    }

    return (
      <section>
        <h2>Schedule</h2>

        <article className={`analysis-card ${readinessClass}`}>
          <h3>Readiness Status: {schedule.readinessStatus}</h3>
          {schedule.complianceWarnings?.length > 0 ? (
            <ul>
              {schedule.complianceWarnings.map((warning, index) => (
                <li key={`${warning.category}-${index}`}>{warning.message}</li>
              ))}
            </ul>
          ) : (
            <p className="message">No compliance warnings.</p>
          )}
        </article>

        <h3>3-Week Lookahead</h3>
        {renderWeekList(appliedAdjustment ? schedule.lookaheadAdjustment?.adjustedLookahead : schedule.lookahead)}

        <h3>Suggested Adjustment</h3>
        <p className="message">Before vs After resequencing (rule-based)</p>
        <div className="analysis-card">
          <strong>Before</strong>
          {renderWeekList(schedule.lookaheadAdjustment?.originalLookahead || schedule.lookahead)}
          <strong>After</strong>
          {renderWeekList(schedule.lookaheadAdjustment?.adjustedLookahead || schedule.lookahead)}
          <ul>
            {(schedule.lookaheadAdjustment?.adjustments || []).map((item, idx) => (
              <li key={`${item.category}-${idx}`}>
                <strong>{item.category}</strong> → {item.action} ({item.reason})
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAppliedAdjustment(true)}>Apply Adjustment</button>
        </div>

        <h3>Actual vs Planned</h3>
        <ul>
          {(schedule.audit?.categoryAudits || []).map((item) => (
            <li
              key={`${item.category}-${item.plannedWeek}`}
              title={`Logs used: ${(item.logsUsed || []).join(", ") || "none"} | ${item.explanation}`}
            >
              {statusDot(item.status)} <strong>{item.category}</strong> (W{item.plannedWeek}) — planned {item.expectedProgress}% | <span style={{ fontWeight: 700 }}>Weather Adjusted {item.adjustedExpectedProgress}%</span> vs actual {item.actualProgress}% ({item.variance}%)
              {item.weatherMultiplier < 1 ? ` | weather x${item.weatherMultiplier}` : ""}
              {item.flags?.length ? ` | Flags: ${item.flags.join(", ")}` : ""}
            </li>
          ))}
        </ul>

        <h3>Trade Coverage</h3>
        <ul>
          {schedule.tradeCoverage?.map((entry) => (
            <li key={entry.category}>
              <strong>{entry.category}</strong>: {entry.coverageStatus}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <h1>Job Detail #{jobId}</h1>
      <p>
        <Link to="/contractor-dashboard">Back to Contractor Dashboard</Link>
      </p>

      {job ? (
        <section>
          <h2>{job.title}</h2>
          <p>{job.description}</p>
          <p>
            Site ZIP: {job.site_zip || "n/a"} · Schedule: {new Date(job.starts_at).toLocaleString()} to {new Date(job.ends_at).toLocaleString()}
          </p>
        </section>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button type="button" onClick={() => setActiveTab("recommendations")}>Recommendations</button>
        <button type="button" onClick={() => setActiveTab("schedule")}>Schedule</button>
      </div>

      {activeTab === "recommendations" ? renderRecommendations() : renderSchedule()}

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
