import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
// 🔥 FULL API FEATURES (merged both branches)
import { 
  createAssignment, 
  getJob, 
  getJobCommand, 
  getJobRecommendations, 
  getJobSchedule 
} from "../services/api.js";
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
  const [recommendations, setRecommendations] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [command, setCommand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [appliedAdjustment, setAppliedAdjustment] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [zoneView, setZoneView] = useState("ROOM");
  const [shiftView, setShiftView] = useState("ALL");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        // 🔥 PARALLEL DATA LOAD (ultra-fast)
        const [jobResponse, recommendationResponse, scheduleResponse, commandResponse] = await Promise.all([
          getJob(jobId, auth).catch(() => null),
          getJobRecommendations(jobId, auth),
          getJobSchedule(jobId, auth),
          getJobCommand(jobId, auth)
        ]);

        if (cancelled) return;

        setJob(jobResponse?.data ?? null);
        setRecommendations(recommendationResponse.data?.gapRecommendations || []);
        setSchedule(scheduleResponse.data);
        setCommand(commandResponse.data || null);
        
        // 🔥 SAFETY MODAL (construction critical!)
        const hasCritical = (scheduleResponse.data?.lookaheadAdjustment?.safetyConflicts || [])
          .some(c => c.severity === "CRITICAL");
        setShowSafetyModal(hasCritical);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load job data");
          setMessage("Partial data available - some features may be limited");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
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

  // 🔥 READINESS STATUS (construction scheduling)
  const readinessClass = useMemo(() => {
    if (!schedule?.readinessStatus) return "severity-medium";
    if (schedule.readinessStatus === "READY") return "severity-low";
    if (schedule.readinessStatus === "AT_RISK") return "severity-medium";
    return "severity-high";
  }, [schedule]);

  // 🔥 ASSIGN WORKER ACTION
  async function handleAssign(workerId) {
    try {
      await createAssignment({ jobId: Number(jobId), workerUserId: workerId }, auth);
      setMessage("✅ Assignment offer sent to worker!");
      setTimeout(() => setMessage(""), 5000);
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    }
  }

  // 🔥 STATUS DOT HELPER
  function statusDot(status) {
    if (status === "GREEN" || status === "healthy") return "🟢";
    if (status === "YELLOW" || status === "caution") return "🟡";
    if (status === "AT_RISK") return "🟠";
    return "🔴";
  }

  // 🔥 SAFETY COLORING
  function safetyColor(severity) {
    if (severity === "CRITICAL") return "#ff6b6b";
    if (severity === "HIGH") return "#ff9f43";
    return "#f6e58d";
  }

  // 🔥 3-WEEK GANTT (construction lookahead)
  function renderWeekList(lookaheadSource) {
    if (!lookaheadSource) return <p>No schedule data</p>;

    return (
      <div className="gantt-grid" style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(3, 1fr)", 
        gap: "1rem",
        marginBottom: "1rem"
      }}>
        <div style={{ background: "#e3f2fd", padding: "1rem", borderRadius: "8px" }}>
          <strong>Week 1</strong>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {(lookaheadSource?.week1 || [])
              .filter(item => shiftView === "ALL" || (item.shift || "AM") === shiftView)
              .map(item => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`)
              .join(", ") || "No planned trades"}
          </div>
        </div>
        <div style={{ background: "#e8f5e8", padding: "1rem", borderRadius: "8px" }}>
          <strong>Week 2</strong>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {(lookaheadSource?.week2 || [])
              .filter(item => shiftView === "ALL" || (item.shift || "AM") === shiftView)
              .map(item => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`)
              .join(", ") || "No planned trades"}
          </div>
        </div>
        <div style={{ background: "#fff3e0", padding: "1rem", borderRadius: "8px" }}>
          <strong>Week 3</strong>
          <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
            {(lookaheadSource?.week3 || [])
              .filter(item => shiftView === "ALL" || (item.shift || "AM") === shiftView)
              .map(item => `${item.category} [${item.zone_id || zoneView}/${item.shift || "AM"}]`)
              .join(", ") || "No planned trades"}
          </div>
        </div>
      </div>
    );
  }

  // 🔥 RECOMMENDATIONS TAB
  function renderRecommendations() {
    return (
      <section style={{ marginTop: "2rem" }}>
        <h2>🤖 AI Worker Recommendations</h2>
        {recommendations.length === 0 ? (
          <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
            🎯 No gaps detected - fully staffed!<br/>
            <small>OMNAS AI found perfect worker-job matches</small>
          </p>
        ) : (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {recommendations.map((gap) => (
              <article key={gap.category} style={{
                border: "1px solid #ddd",
                borderRadius: "12px",
                padding: "1.5rem",
                background: gap.severity === "low" ? "#e8f5e8" : "#fff3cd"
              }}>
                <h3 style={{ marginTop: 0 }}>
                  {gap.category} ({gap.severity})
                </h3>
                <div style={{ display: "grid", gap: "1rem" }}>
                  {gap.topRecommendations?.map((item) => (
                    <div key={item.workerId} style={{
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div>
                        <strong>{item.workerName}</strong>
                        {item.bestFitForGap && <span style={{ color: "#1976d2", marginLeft: "0.5rem" }}>⭐ Best Fit</span>}
                        <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                          Score: {item.fitScore}% | Trade: {item.tradeFitType} | 
                          Compliance: <span style={{ color: item.complianceStatus === "compliant" ? "#388e3c" : "#d32f2f" }}>
                            {item.complianceStatus}
                          </span>
                          {item.requiresLicensedTrade && " (⚠️ Licensed required)"}
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleAssign(item.workerId)}
                        style={{
                          padding: "0.5rem 1.5rem",
                          background: "#1976d2",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  // 🔥 SCHEDULE TAB (construction lookahead)
  function renderSchedule() {
    if (!schedule) return <p style={{ color: "#666" }}>Schedule loading...</p>;

    return (
      <section style={{ marginTop: "2rem" }}>
        <h2>📅 3-Week Construction Lookahead</h2>
        
        {/* 🔥 VIEW CONTROLS */}
        <div style={{ 
          display: "flex", 
          gap: "1rem", 
          marginBottom: "1.5rem", 
          padding: "1rem",
          background: "#f8f9fa",
          borderRadius: "8px"
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Zone: 
            <select value={zoneView} onChange={(e) => setZoneView(e.target.value)}>
              <option value="ROOM">Room</option>
              <option value="FLOOR">Floor</option>
              <option value="BUILDING">Building</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Shift: 
            <select value={shiftView} onChange={(e) => setShiftView(e.target.value)}>
              <option value="ALL">All Shifts</option>
              <option value="AM">AM (6-12)</option>
              <option value="PM">PM (12-6)</option>
            </select>
          </label>
        </div>

        {/* 🔥 READINESS STATUS */}
        <article style={{
          background: readinessClass.includes("low") ? "#e8f5e8" : readinessClass.includes("high") ? "#f8d7da" : "#fff3cd",
          border: `2px solid ${readinessClass.includes("low") ? "#4caf50" : readinessClass.includes("high") ? "#f44336" : "#ff9800"}`,
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1.5rem"
        }}>
          <h3>🎯 Readiness: {schedule.readinessStatus}</h3>
          {schedule.complianceWarnings?.length > 0 ? (
            <ul style={{ margin: "1rem 0", color: "#d32f2f" }}>
              {schedule.complianceWarnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#388e3c" }}>✅ No compliance issues detected</p>
          )}
        </article>

        {/* 🔥 3-WEEK GANTT CHART */}
        {renderWeekList(
          appliedAdjustment 
            ? schedule.lookaheadAdjustment?.adjustedLookahead 
            : schedule.lookahead
        )}

        {/* 🔥 SCHEDULE ADJUSTMENT */}
        {schedule.lookaheadAdjustment && (
          <div style={{ 
            background: "#e3f2fd", 
            borderRadius: "12px", 
            padding: "1.5rem", 
            margin: "1.5rem 0" 
          }}>
            <h3>🤖 AI Schedule Adjustment</h3>
            <div style={{ display: "flex", gap: "2rem", marginBottom: "1rem" }}>
              <div><strong>Before:</strong> {renderWeekList(schedule.lookaheadAdjustment.originalLookahead)}</div>
              <div><strong>After:</strong> {renderWeekList(schedule.lookaheadAdjustment.adjustedLookahead)}</div>
            </div>
            <ul style={{ fontSize: "0.95rem" }}>
              {(schedule.lookaheadAdjustment.adjustments || []).map((item, idx) => (
                <li key={idx}>
                  <strong>{item.category}</strong> → {item.action} ({item.reason})
                </li>
              ))}
            </ul>
            <button 
              type="button" 
              onClick={() => setAppliedAdjustment(true)}
              disabled={schedule.lookaheadAdjustment.blocked}
              style={{
                padding: "0.75rem 1.5rem",
                background: schedule.lookaheadAdjustment.blocked ? "#ccc" : "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: schedule.lookaheadAdjustment.blocked ? "not-allowed" : "pointer"
              }}
            >
              ✅ Apply AI Adjustment
            </button>
          </div>
        )}

        {/* 🔥 RISK WARNINGS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
          <article style={{ background: "#fff3cd", padding: "1rem", borderRadius: "8px" }}>
            <h4>⚠️ Dependency Warnings</h4>
            <ul style={{ fontSize: "0.9rem" }}>
              {(schedule.lookaheadAdjustment?.dependencyWarnings || schedule.audit?.dependencyWarnings || [])
                .map((item, idx) => (
                  <li key={`dep-${idx}`}>
                    {item.type === "hard" ? "⛔" : "⚠️"} {item.category}: {item.message}
                  </li>
                ))}
            </ul>
          </article>

          <article style={{ background: "#f8d7da", padding: "1rem", borderRadius: "8px" }}>
            <h4>🚨 Safety Conflicts</h4>
            <ul style={{ fontSize: "0.9rem" }}>
              {(schedule.lookaheadAdjustment?.safetyConflicts || [])
                .map((item, idx) => (
                  <li key={`safe-${idx}`} style={{ color: safetyColor(item.severity) }}>
                    {item.severity} {item.tradeA} vs {item.tradeB} in {item.zone} ({item.time})
                  </li>
                ))}
            </ul>
          </article>
        </div>
      </section>
    );
  }

  // 🔥 COMMAND TAB (merged role-aware)
  function renderCommand() {
    if (!command) return <p style={{ color: "#666" }}>Command loading...</p>;

    return (
      <section style={{ marginTop: "2rem" }}>
        <CommandTab command={command} role={role} />
        
        {/* 🔥 QUICK ACTIONS */}
        <div style={{ 
          display: "flex", 
          gap: "1rem", 
          marginTop: "2rem", 
          padding: "1.5rem",
          background: "#f8f9fa",
          borderRadius: "12px"
        }}>
          <Link 
            to={`/job-matches/${jobId}`} 
            style={{
              padding: "1rem 2rem",
              background: "#388e3c",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              fontWeight: "bold"
            }}
          >
            👥 View Worker Matches ({command.matchPool?.totalMatches || 0})
          </Link>
          {command.actions?.length > 0 && (
            <button style={{
              padding: "1rem 2rem",
              background: command.health.status === "GREEN" ? "#4caf50" : "#ff9800",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer"
            }}>
              🎯 Execute Top Action ({command.actions[0]?.priority})
            </button>
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        textAlign: "center", 
        padding: "4rem 2rem", 
        color: "#666" 
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏗️</div>
        <h2>Loading Construction Command Center...</h2>
        <p>AI analyzing schedule, risks, and profit impact</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "0 1rem" }}>
      {/* 🔥 HEADER */}
      <nav style={{ 
        padding: "1rem 0", 
        marginBottom: "2rem",
        borderBottom: "1px solid #eee"
      }}>
        <Link 
          to="/contractor-dashboard" 
          style={{ 
            color: "#1976d2", 
            textDecoration: "none", 
            fontWeight: "bold",
            padding: "0.75rem 1.5rem",
            background: "#e3f2fd",
            borderRadius: "8px"
          }}
        >
          ← Back to Dashboard
        </Link>
      </
      
      