import { useEffect, useState } from "react";
import {
  getTriageSummary,
  getBlockLog,
  createComplianceOverride
} from "../services/api.js";
import { getStoredAuth } from "../hooks/useAuth.js";

// ─── shared styles ────────────────────────────────────────────────────────────

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "1.25rem 1.5rem",
  background: "white",
  marginBottom: "0.75rem",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
};

const badge = (color) => ({
  display: "inline-block",
  padding: "0.2rem 0.65rem",
  borderRadius: "20px",
  fontSize: "0.8rem",
  fontWeight: 700,
  background: color === "red" ? "#fee2e2" : color === "amber" ? "#fef3c7" : color === "green" ? "#dcfce7" : "#e0e7ff",
  color: color === "red" ? "#b91c1c" : color === "amber" ? "#92400e" : color === "green" ? "#15803d" : "#4338ca",
  marginRight: "0.4rem"
});

const btn = (variant = "primary") => ({
  padding: "0.55rem 1.2rem",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.875rem",
  background: variant === "primary" ? "#4f46e5"
    : variant === "ghost"   ? "transparent"
    : variant === "danger"  ? "#ef4444"
    : "#e2e8f0",
  color: variant === "primary" || variant === "danger" ? "white" : variant === "ghost" ? "#4f46e5" : "#374151",
  border: variant === "ghost" ? "1px solid #4f46e5" : "none"
});

const TABS = ["Locked Jobs", "Compliance Alerts", "Ghost Events"];

// ─── Override Modal ────────────────────────────────────────────────────────────

function OverrideModal({ prefill, auth, onClose, onSuccess }) {
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [form, setForm] = useState({
    overrideType: prefill.overrideType ?? "ASSIGNMENT_ACCEPT",
    reasonCode:   prefill.reasonCode   ?? "",
    reasonText:   "",
    workerUserId: prefill.workerUserId ?? "",
    companyId:    prefill.companyId    ?? "",
    expiresAt:    sevenDays
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await createComplianceOverride(form, auth);
      onSuccess("Override granted.");
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "2rem", width: "min(520px, 92vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.1rem" }}>Grant Compliance Override</h3>

        <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Override Type
            <select
              value={form.overrideType}
              onChange={(e) => set("overrideType", e.target.value)}
              style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="ASSIGNMENT_ACCEPT">Assignment Accept</option>
              <option value="CHECKIN">Check-In</option>
            </select>
          </label>

          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Reason Code
            <input
              required
              value={form.reasonCode}
              onChange={(e) => set("reasonCode", e.target.value)}
              placeholder="e.g. COMPANY_SUSPENDED"
              style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            />
          </label>

          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Justification
            <textarea
              rows={3}
              value={form.reasonText}
              onChange={(e) => set("reasonText", e.target.value)}
              placeholder="Why is this override being granted?"
              style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "vertical", boxSizing: "border-box" }}
            />
          </label>

          {form.workerUserId && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
              Worker: <strong>{form.workerUserId}</strong>
            </p>
          )}
          {form.companyId && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
              Company: <strong>{form.companyId}</strong>
            </p>
          )}

          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Expires At
            <input
              type="datetime-local"
              required
              value={form.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
            />
          </label>

          {err && <p style={{ color: "#dc2626", margin: 0, fontSize: "0.85rem" }}>{err}</p>}

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
            <button type="button" onClick={onClose} style={btn("secondary")}>Cancel</button>
            <button type="submit" disabled={saving} style={btn("primary")}>
              {saving ? "Saving…" : "Grant Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Block Log Drilldown ───────────────────────────────────────────────────────

function BlockLogPanel({ entityType, entityId, auth, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlockLog(entityType, entityId, auth)
      .then((r) => setEntries(r.data ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId, auth]);

  return (
    <div style={{ ...card, border: "2px solid #4f46e5", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>Block Log — {entityType} #{entityId}</strong>
        <button onClick={onClose} style={btn("ghost")}>Close</button>
      </div>
      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No block events recorded.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ fontSize: "0.82rem", padding: "0.6rem 0.75rem", background: "#f8fafc", borderRadius: "6px" }}>
              <span style={badge("red")}>{e.reason_code}</span>
              <span style={badge("amber")}>{e.block_type}</span>
              <span style={{ color: "#475569" }}>{e.reason_detail}</span>
              <span style={{ float: "right", color: "#94a3b8" }}>{new Date(e.blocked_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel: Locked Jobs ────────────────────────────────────────────────────────

function LockedJobsPanel({ jobs, auth }) {
  const [drilldown, setDrilldown] = useState(null);

  if (jobs.length === 0) {
    return <p style={{ color: "#94a3b8", padding: "2rem 0", textAlign: "center" }}>No locked jobs — field is clear.</p>;
  }

  return (
    <div>
      {jobs.map((j) => {
        const isOpen = drilldown?.entityId === j.jobId;
        return (
          <div key={j.jobId}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{j.title}</strong>
                  <div style={{ marginTop: "0.35rem" }}>
                    <span style={badge("amber")}>{j.jobStatus}</span>
                    {(j.reasonCodes ?? []).map((rc) => (
                      <span key={rc} style={badge("red")}>{rc}</span>
                    ))}
                  </div>
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
                    {j.blockCount} block event{j.blockCount !== 1 ? "s" : ""} · Last: {j.lastBlockedAt ? new Date(j.lastBlockedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <button
                  onClick={() => setDrilldown(isOpen ? null : { entityType: "assignment", entityId: j.jobId })}
                  style={btn(isOpen ? "secondary" : "ghost")}
                >
                  {isOpen ? "Hide Log" : "View Block Log"}
                </button>
              </div>
            </div>
            {isOpen && (
              <BlockLogPanel
                entityType="assignment"
                entityId={j.jobId}
                auth={auth}
                onClose={() => setDrilldown(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Panel: Compliance Alerts ─────────────────────────────────────────────────

function ComplianceAlertsPanel({ alerts, auth, onOverrideSuccess }) {
  const [modal, setModal] = useState(null);

  if (alerts.length === 0) {
    return <p style={{ color: "#94a3b8", padding: "2rem 0", textAlign: "center" }}>No compliance alerts.</p>;
  }

  return (
    <div>
      {modal && (
        <OverrideModal
          prefill={modal}
          auth={auth}
          onClose={() => setModal(null)}
          onSuccess={onOverrideSuccess}
        />
      )}

      {alerts.map((a, i) => {
        if (a.alertType === "COMPANY_STATUS") {
          const isSuspended = a.status === "SUSPENDED";
          return (
            <div key={i} style={{ ...card, borderLeft: `4px solid ${isSuspended ? "#ef4444" : "#f59e0b"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <strong>{a.companyName}</strong>
                  <div style={{ marginTop: "0.35rem" }}>
                    <span style={badge(isSuspended ? "red" : "amber")}>{a.status}</span>
                    {a.reasonCode && <span style={badge("amber")}>{a.reasonCode}</span>}
                  </div>
                  {a.reason && <p style={{ margin: "0.4rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>{a.reason}</p>}
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                    {a.activeWorkerCount} active worker{a.activeWorkerCount !== 1 ? "s" : ""} · Since {new Date(a.effectiveAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => setModal({
                    overrideType: "ASSIGNMENT_ACCEPT",
                    reasonCode:   a.reasonCode ?? a.status,
                    companyId:    a.companyId,
                    workerUserId: null
                  })}
                  style={btn("ghost")}
                >
                  Grant Override
                </button>
              </div>
            </div>
          );
        }

        if (a.alertType === "CREDENTIAL_EXPIRED") {
          return (
            <div key={i} style={{ ...card, borderLeft: "4px solid #f59e0b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                  <strong>{a.workerName}</strong>
                  <div style={{ marginTop: "0.35rem" }}>
                    {(a.expiredTypes ?? []).map((t) => (
                      <span key={t} style={badge("amber")}>{t}</span>
                    ))}
                  </div>
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                    Most recent expiry: {a.mostRecentExpiry ? new Date(a.mostRecentExpiry).toLocaleDateString() : "—"}
                  </p>
                </div>
                <button
                  onClick={() => setModal({
                    overrideType: "CHECKIN",
                    reasonCode:   "CREDENTIAL_EXPIRED",
                    workerUserId: a.workerUserId,
                    companyId:    null
                  })}
                  style={btn("ghost")}
                >
                  Grant Override
                </button>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

// ─── Panel: Ghost Events ───────────────────────────────────────────────────────

function GhostEventsPanel({ ghostEvents }) {
  const { ghostedAssignments = [], pendingEscalations = [] } = ghostEvents ?? {};
  const total = ghostedAssignments.length + pendingEscalations.length;

  if (total === 0) {
    return <p style={{ color: "#94a3b8", padding: "2rem 0", textAlign: "center" }}>No ghost events detected.</p>;
  }

  return (
    <div>
      {ghostedAssignments.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ghosted Assignments ({ghostedAssignments.length})
          </h4>
          {ghostedAssignments.map((g, i) => (
            <div key={i} style={card}>
              <span style={badge("red")}>GHOST</span>
              <strong style={{ fontSize: "0.9rem" }}>Assignment #{g.assignment_id ?? g.id}</strong>
              {g.worker_user_id && (
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                  Worker: {g.worker_user_id}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingEscalations.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ghost Escalations ({pendingEscalations.length})
          </h4>
          {pendingEscalations.map((e, i) => (
            <div key={i} style={card}>
              <strong style={{ fontSize: "0.9rem" }}>{e.reason}</strong>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                {e.zone} · {e.status} · {new Date(e.created_at ?? e.escalated_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// Fallback for pilot: contractor sees their own triage view.
const FALLBACK_AUTH = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };

export function TriageDashboardPage() {
  const auth = getStoredAuth() ?? FALLBACK_AUTH;

  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(0);
  const [flash, setFlash]       = useState("");
  const [error, setError]       = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await getTriageSummary(auth);
      setSummary(res.data ?? res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function handleOverrideSuccess(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(""), 4000);
    refresh();
  }

  const meta   = summary?.meta   ?? {};
  const counts = [
    meta.lockedJobCount       ?? 0,
    meta.complianceAlertCount ?? 0,
    meta.ghostEventCount      ?? 0
  ];

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>Operations Triage</h1>
          {meta.generatedAt && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
              Updated {new Date(meta.generatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button onClick={refresh} style={btn("secondary")} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div style={{ padding: "0.75rem 1rem", background: "#dcfce7", borderRadius: "8px", marginBottom: "1rem", color: "#15803d", fontWeight: 600, fontSize: "0.875rem" }}>
          {flash}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "#fee2e2", borderRadius: "8px", marginBottom: "1rem", color: "#b91c1c", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {/* Metric strip */}
      {!loading && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              style={{
                padding: "1rem",
                borderRadius: "12px",
                border: `2px solid ${tab === i ? "#4f46e5" : "#e2e8f0"}`,
                background: tab === i ? "#eef2ff" : "white",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: counts[i] > 0 ? (i === 0 ? "#b91c1c" : "#92400e") : "#15803d" }}>
                {counts[i]}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {!loading && summary && (
        <div>
          {tab === 0 && (
            <LockedJobsPanel jobs={summary.lockedJobs ?? []} auth={auth} />
          )}
          {tab === 1 && (
            <ComplianceAlertsPanel
              alerts={summary.complianceAlerts ?? []}
              auth={auth}
              onOverrideSuccess={handleOverrideSuccess}
            />
          )}
          {tab === 2 && (
            <GhostEventsPanel ghostEvents={summary.ghostEvents} />
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "#94a3b8" }}>
          Loading triage data…
        </div>
      )}
    </div>
  );
}
