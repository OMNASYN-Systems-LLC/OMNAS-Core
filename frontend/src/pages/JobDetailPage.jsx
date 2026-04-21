import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createAssignment, getJob, getJobDashboard, getJobRecommendations, getJobSchedule } from "../services/api.js";

export function JobDetailPage() {
  const { jobId } = useParams();
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [activeTab, setActiveTab] = useState("recommendations");
  const [job, setJob] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("");
  const [appliedAdjustment, setAppliedAdjustment] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [zoneView, setZoneView] = useState("ROOM");
  const [shiftView, setShiftView] = useState("ALL");

  useEffect(() => {
    async function load() {
      try {
        const [jobResponse, recommendationResponse, scheduleResponse, dashboardResponse] = await Promise.all([
          getJob(jobId, auth),
          getJobRecommendations(jobId, auth),
          getJobSchedule(jobId, auth),
          getJobDashboard(jobId, auth)
        ]);

        setJob(jobResponse.data);
        setRecommendations(recommendationResponse.data.gapRecommendations || []);
        setSchedule(scheduleResponse.data);
        setDashboard(dashboardResponse.data || null);
        const hasCritical = (scheduleResponse.data?.lookaheadAdjustment?.safetyConflicts || []).some((c) => c.severity === "CRITICAL");
        setShowSafetyModal(hasCritical);
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



  function safetyColor(severity) {
    if (severity === "CRITICAL") return "#ff6b6b";
    if (severity === "HIGH") return "#ff9f43";
    return "#f6e58d";
  }

  function renderWeekList(lookaheadSource) {
    return (
      <div className="gantt-grid">
        <div className="gantt-row">
          <strong>Week 1</strong>
          <div className="gantt-bar week1">{(lookaheadSource?.week1 || []).filter((item) => shiftView === "ALL" || (item.shift || "AM") === shiftView).map((item) => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`).join(", ") || "No planned trades"}</div>
        </div>
        <div className="gantt-row">
          <strong>Week 2</strong>
          <div className="gantt-bar week2">{(lookaheadSource?.week2 || []).filter((item) => shiftView === "ALL" || (item.shift || "AM") === shiftView).map((item) => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`).join(", ") || "No planned trades"}</div>
        </div>
        <div className="gantt-row">
          <strong>Week 3</strong>
          <div className="gantt-bar week3">{(lookaheadSource?.week3 || []).filter((item) => shiftView === "ALL" || (item.shift || "AM") === shiftView).map((item) => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`).join(", ") || "No planned trades"}</div>
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
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <label>Zone View
            <select value={zoneView} onChange={(e) => setZoneView(e.target.value)}>
              <option value="ROOM">Room</option>
              <option value="FLOOR">Floor</option>
            </select>
          </label>
          <label>Shift View
            <select value={shiftView} onChange={(e) => setShiftView(e.target.value)}>
              <option value="ALL">All</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </label>
        </div>

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
          <button type="button" onClick={() => setAppliedAdjustment(true)} disabled={schedule.lookaheadAdjustment?.blocked}>Apply Adjustment</button>
        </div>


        <h3>Capacity vs Required Work</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.capacityAnalysis || []).map((item) => (
            <li key={`cap-${item.category}`}>
              <strong>{item.category}</strong>: workers {item.workers}, capacity {item.capacity}, required {item.requiredWork}, weather-adjusted x{item.weatherMultiplier}, duration {item.adjustedDuration} day(s)
            </li>
          ))}
        </ul>


        <h3>Dependency Warnings</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.dependencyWarnings || schedule.audit?.dependencyWarnings || []).map((item, idx) => (
            <li key={`dep-${idx}`} title={item.message}>
              {item.type === "hard" ? "⛔" : "⚠️"} {item.category}: {item.message}
            </li>
          ))}
        </ul>

        <h3>Congestion / Trade Stacking</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.congestionWarnings || schedule.audit?.congestionWarnings || []).map((item, idx) => (
            <li key={`con-${idx}`} title="Congested: >200 SF per worker">⚠️ {item.category}: {item.message}</li>
          ))}
        </ul>

        <h3>Fatigue Indicators</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.fatigueWarnings || schedule.audit?.fatigueWarnings || []).map((item, idx) => (
            <li key={`fat-${idx}`} title="Fatigue: >50 hrs/week">🟠 {item.category || item.workerId}: {item.message}</li>
          ))}
        </ul>

        <h3>Safety Conflicts</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.safetyConflicts || []).map((item, idx) => (
            <li
              key={`safe-${idx}`}
              title={`Conflict exists because ${item.tradeA} and ${item.tradeB} overlap in ${item.zone} during ${item.time}.`}
              style={{ color: safetyColor(item.severity) }}
            >
              {item.severity} ({item.action}): {item.tradeA} vs {item.tradeB} in {item.zone} ({item.time})
            </li>
          ))}
        </ul>

        <h3>Zone/Time Conflict Visualization</h3>
        <ul>
          {(schedule.lookaheadAdjustment?.spatialConflicts || []).map((item, idx) => (
            <li key={`sp-${idx}`}>Zone conflict: {item.tradeA} vs {item.tradeB} in {item.zone} ({item.time})</li>
          ))}
          {(schedule.lookaheadAdjustment?.temporalConflicts || []).map((item, idx) => (
            <li key={`tm-${idx}`}>Time conflict: {item.tradeA} vs {item.tradeB} ({item.time})</li>
          ))}
        </ul>

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

  function commandColor(status) {
    if (status === "GREEN") return "status-green";
    if (status === "YELLOW") return "status-yellow";
    return "status-red";
  }

  function renderCommand() {
    if (!dashboard) {
      return <p className="message">Command view unavailable.</p>;
    }

    return (
      <section>
        <article className={`analysis-card ${commandColor(dashboard.hero?.status)}`}>
          <h2>Health Score: {dashboard.hero?.healthScore ?? 0}</h2>
          <p><strong>Status:</strong> {dashboard.hero?.status || "RED"}</p>
          <p><strong>Project losing:</strong> ${Number(dashboard.financial?.dailyLoss || 0).toLocaleString()}/day</p>
        </article>

        <article className="analysis-card status-red">
          <h3>Financial Impact</h3>
          <p>Daily Loss: ${Number(dashboard.financial?.dailyLoss || 0).toLocaleString()}</p>
          <p>Weekly Projection: ${Number(dashboard.financial?.weeklyProjection || 0).toLocaleString()}</p>
          <ul>
            {(dashboard.financial?.topDrivers || []).slice(0, 3).map((driver, idx) => (
              <li key={`driver-${idx}`}>{driver.description} (${Number(driver.dailyImpactUsd || 0).toLocaleString()}/day)</li>
            ))}
          </ul>
        </article>

        <article className="analysis-card status-yellow">
          <h3>Execution Status</h3>
          <p>Schedule Drift: {dashboard.execution?.scheduleDriftDays || 0} days</p>
          <p>Readiness: {dashboard.execution?.readinessPercent || 0}%</p>
          <p>Missing Work: {dashboard.execution?.missingWorkCount || 0}</p>
          <p>Delayed Trades: {dashboard.execution?.delayedCategoriesCount || 0}</p>
        </article>

        <article className="analysis-card status-yellow">
          <h3>Risks</h3>
          <p>Escalations: {dashboard.risks?.escalationsCount || 0}</p>
          <p>Hard Locks: {dashboard.risks?.hardLocksCount || 0}</p>
          <p>Congestion Warnings: {dashboard.risks?.congestionWarnings || 0}</p>
          <p>Safety Flags: {dashboard.risks?.safetyFlags || 0}</p>
        </article>

        <article className="analysis-card status-green">
          <h3>Automation</h3>
          <p>AI resolved {dashboard.automation?.autoResolutionsCount || 0} issues.</p>
          <p>{dashboard.automation?.pendingOverridesCount || 0} decisions need approval.</p>
          <p>{dashboard.automation?.pendingEscalationsCount || 0} escalations pending.</p>
        </article>

        <article className="analysis-card status-red">
          <h3>Forecast</h3>
          <p>At current pace: +{dashboard.forecast?.projectedDelayDays || 0} days delay</p>
          <p>Projected loss: ${Number(dashboard.forecast?.projectedLoss || 0).toLocaleString()}</p>
        </article>

        <article className="analysis-card status-yellow">
          <h3>Action Queue</h3>
          <ul>
            {(dashboard.actions || []).map((action, idx) => (
              <li key={`action-${idx}`}>
                <strong>{action.type}</strong> [{action.severity}] — {action.description}
                <br />
                Required: {action.requiredAction}
              </li>
            ))}
          </ul>
          <p className="message">Confidence: {dashboard.confidence ?? 0}</p>
        </article>
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
        <button type="button" onClick={() => setActiveTab("command")}>Command</button>
      </div>

      {activeTab === "recommendations" ? renderRecommendations() : activeTab === "schedule" ? renderSchedule() : renderCommand()}

      {showSafetyModal ? (
        <div className="analysis-card severity-high">
          <h3>Safety Conflict</h3>
          <p>{schedule?.lookaheadAdjustment?.error || "Cannot schedule conflicting trades in same zone."}</p>
          <p className="message">Conflict occurs in Zone: {schedule?.lookaheadAdjustment?.safetyConflicts?.[0]?.zone || "N/A"}</p>
          <p className="message">Time: {schedule?.lookaheadAdjustment?.safetyConflicts?.[0]?.time || "N/A"}</p>
          <p className="message">Distance Risk: {schedule?.lookaheadAdjustment?.safetyConflicts?.[0]?.message || "Trade separation rule triggered."}</p>
          <button type="button" onClick={() => setShowSafetyModal(false)}>Cancel</button>
          <button
            type="button"
            onClick={() => setShowSafetyModal(false)}
            disabled={auth.role !== "contractor"}
            style={{ marginLeft: "0.5rem" }}
          >
            Override
          </button>
        </div>
      ) : null}

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
