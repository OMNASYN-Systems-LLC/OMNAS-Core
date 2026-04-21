import { Link } from "react-router-dom";

const TONE = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  neutral: "#64748b",
};

const STATUS_BADGE = {
  pending: { label: "pending", bg: "#fef9c3", color: "#854d0e" },
  sent:    { label: "sent",    bg: "#dbeafe", color: "#1e40af" },
  responded: { label: "responded", bg: "#dcfce7", color: "#166534" },
  ignored: { label: "ignored", bg: "#f3f4f6", color: "#6b7280" },
};

function toneFor(metric, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "neutral";
  const n = Number(value);
  switch (metric) {
    case "loss":
      if (n < 500) return "green";
      if (n <= 2000) return "yellow";
      return "red";
    case "drift":
      if (n === 0) return "green";
      if (n <= 3) return "yellow";
      return "red";
    case "confidence":
      if (n >= 80) return "green";
      if (n >= 60) return "yellow";
      return "red";
    case "readiness":
      if (n >= 90) return "green";
      if (n >= 60) return "yellow";
      return "red";
    case "production":
      if (n >= 0) return "green";
      if (n >= -20) return "yellow";
      return "red";
    case "conflicts":
      if (n === 0) return "green";
      if (n <= 2) return "yellow";
      return "red";
    default:
      return "neutral";
  }
}

function formatCurrency(value, { compact = false } = {}) {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  });
}

function plainConfidence(score) {
  if (score >= 80) return "Likely to hit deadline";
  if (score >= 60) return "Tight — needs attention";
  return "Unlikely to hit deadline";
}

function StatusBadge({ status }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.55rem",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 600,
        background: badge.bg,
        color: badge.color,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {badge.label}
    </span>
  );
}

function SendButton({ action, directive, onSend, sending }) {
  if (directive) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <StatusBadge status={directive.status} />
      </span>
    );
  }

  if (action.id === "all-clear") return null;

  return (
    <button
      type="button"
      onClick={() => onSend(action)}
      disabled={sending}
      style={{
        padding: "0.3rem 0.85rem",
        borderRadius: "6px",
        border: "1px solid currentColor",
        background: "transparent",
        cursor: sending ? "not-allowed" : "pointer",
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "#1d4ed8",
        opacity: sending ? 0.5 : 1,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {sending ? "Sending…" : "Send Recommendation"}
    </button>
  );
}

function HeroStrip({ dashboard }) {
  const profitLoss = dashboard.hero?.profitLoss ?? null;
  const scheduleRisk = dashboard.hero?.scheduleRisk ?? null;
  const confidence = dashboard.confidence?.score ?? 0;

  const lossTone = toneFor("loss", profitLoss ?? 0);
  const driftTone = toneFor("drift", scheduleRisk ?? 0);
  const confTone = toneFor("confidence", confidence);
  const topDriver = dashboard.cause?.[0];

  return (
    <section className="hero-strip">
      <div
        className={`hero-cell hero-loss tone-${lossTone}`}
        aria-label={`Profit impact ${formatCurrency(profitLoss)} per day`}
      >
        <div className="hero-loss-value">{profitLoss !== null ? formatCurrency(profitLoss) : "—"}</div>
        <div className="hero-loss-unit">per day</div>
        <div className="hero-loss-sub">
          {profitLoss ? "Estimated daily impact" : "No tracked loss"}
        </div>
        {topDriver ? (
          <div className="hero-loss-driver">Driven by {topDriver.label.toLowerCase()}</div>
        ) : null}
      </div>

      <div className={`hero-cell tone-${driftTone}`}>
        <div className="hero-secondary-label">Schedule Risk</div>
        <div className="hero-secondary-value">
          {scheduleRisk !== null ? `+${scheduleRisk}d` : "On Plan"}
        </div>
        <div className="hero-secondary-sub">
          {scheduleRisk ? `${scheduleRisk}d behind plan` : "Tracking to schedule"}
        </div>
      </div>

      <div className={`hero-cell tone-${confTone}`}>
        <div className="hero-secondary-label">Confidence</div>
        <div className="hero-secondary-value">{confidence}%</div>
        <div className="hero-secondary-sub">{plainConfidence(confidence)}</div>
      </div>
    </section>
  );
}

function CausePanel({ cause }) {
  const top = (cause ?? []).slice(0, 3);
  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Why we&apos;re losing money</h3>
        <span className="dash-panel-sub">Top {top.length} driver(s)</span>
      </header>
      {top.length === 0 ? (
        <p className="dash-empty">No material loss drivers detected.</p>
      ) : (
        <ol className="cause-list">
          {top.map((d, idx) => (
            <li key={idx} className="cause-row">
              <span className="cause-rank">{idx + 1}</span>
              <span className="cause-label">{d.label}</span>
              {d.impact !== null ? (
                <span className="cause-impact">{formatCurrency(d.impact)}/day</span>
              ) : (
                <span className="cause-impact">—</span>
              )}
              <span className="cause-why">{d.metric}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// directivesByActionId: { [actionId]: directive }
// onSend: (action) => void
// sending: Set of actionIds currently in-flight
function ActionPanel({ action, directivesByActionId, onSend, sending }) {
  const list = action ?? [];
  const urgent = list.filter((a) => ["high", "critical"].includes(a.priority));
  const suggested = list.filter(
    (a) => !["high", "critical"].includes(a.priority) && a.id !== "all-clear"
  );
  const allClear = list.length === 1 && list[0].id === "all-clear";

  if (allClear) {
    return (
      <section className="dash-panel">
        <header className="dash-panel-header">
          <h3>What to do next</h3>
        </header>
        <p className="dash-empty">No decisions required — system is stable.</p>
      </section>
    );
  }

  function renderItem(a, colClass) {
    const directive = directivesByActionId?.[a.id] ?? null;
    const isSending = sending?.has(a.id) ?? false;

    return (
      <li key={a.id} className={`action-item${colClass ? ` ${colClass}` : ""}`}>
        <span className="action-text">{a.label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {a.route ? (
            <Link to={a.route} className="action-btn action-btn-ghost" style={{ fontSize: "0.8rem" }}>
              {a.cta}
            </Link>
          ) : null}
          <SendButton
            action={a}
            directive={directive}
            onSend={onSend}
            sending={isSending}
          />
        </span>
      </li>
    );
  }

  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>What to do next</h3>
      </header>
      <div className="action-grid">
        <div className="action-col">
          <div className="action-col-title">System recommends</div>
          {suggested.length === 0 ? (
            <p className="dash-empty">No recommendations.</p>
          ) : (
            <ul className="action-list">{suggested.map((a) => renderItem(a, ""))}</ul>
          )}
        </div>
        <div className="action-col action-col-approval">
          <div className="action-col-title">Needs your approval</div>
          {urgent.length === 0 ? (
            <p className="dash-empty">No pending approvals.</p>
          ) : (
            <ul className="action-list">{urgent.map((a) => renderItem(a, "action-item-urgent"))}</ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ExecutionPanel({ execution }) {
  const active = execution?.activeAssignments ?? 0;
  const conflicts = execution?.conflicts ?? 0;
  const delta = execution?.productionDelta ?? null;

  const prodTone = toneFor("production", delta ?? 0);
  const confTone = toneFor("conflicts", conflicts);

  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Execution</h3>
      </header>
      <div className="exec-row">
        <div className="exec-tile">
          <div className="exec-tile-label">Active Assignments</div>
          <div className="exec-tile-value tone-text-neutral">{active}</div>
          <div className="exec-tile-sub">workers currently active</div>
        </div>

        <div className="exec-tile">
          <div className="exec-tile-label">Trade Conflicts</div>
          <div className={`exec-tile-value tone-text-${confTone}`}>{conflicts}</div>
          <div className="exec-tile-sub">
            {conflicts === 0 ? "No active conflicts" : `${conflicts} flagged`}
          </div>
        </div>

        <div className="exec-tile">
          <div className="exec-tile-label">Production vs Plan</div>
          <div className={`exec-tile-value tone-text-${prodTone}`}>
            {delta !== null ? `${delta > 0 ? "+" : ""}${delta}%` : "—"}
          </div>
          <div className="exec-tile-sub">vs planned staffing</div>
        </div>
      </div>
    </section>
  );
}

function ForecastPanel({ forecast }) {
  const delay = forecast?.projectedDelay ?? null;
  const uncertainty = forecast?.uncertainty ?? null;
  const delayTone = toneFor("drift", delay ?? 0);

  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Forecast — if no action taken</h3>
      </header>
      <div className="forecast-row">
        <div className="forecast-cell">
          <div className="forecast-label">Projected delay</div>
          <div className={`forecast-value tone-text-${delayTone}`}>
            {delay !== null ? `${delay}d` : "—"}
          </div>
        </div>
        <div className="forecast-cell">
          <div className="forecast-label">Uncertainty</div>
          <div className="forecast-value">{uncertainty ?? "—"}</div>
        </div>
      </div>
    </section>
  );
}

function ClientView({ dashboard }) {
  const score = dashboard.confidence?.score ?? 0;
  const level = dashboard.confidence?.level ?? "unknown";
  const delay = dashboard.forecast?.projectedDelay ?? null;
  const confTone = toneFor("confidence", score);
  const driftTone = toneFor("drift", delay ?? 0);

  return (
    <div className="client-view">
      <section className="hero-strip">
        <div className={`hero-cell tone-${confTone}`}>
          <div className="hero-secondary-label">Completion Confidence</div>
          <div className="hero-secondary-value">{score}%</div>
          <div className="hero-secondary-sub">{plainConfidence(score)}</div>
        </div>
        <div className="hero-cell tone-green">
          <div className="hero-secondary-label">Confidence Level</div>
          <div className="hero-secondary-value">{level}</div>
          <div className="hero-secondary-sub">based on current signals</div>
        </div>
        <div className={`hero-cell tone-${driftTone}`}>
          <div className="hero-secondary-label">Schedule Status</div>
          <div className="hero-secondary-value">
            {delay !== null ? `+${delay}d` : "On Plan"}
          </div>
          <div className="hero-secondary-sub">
            {delay ? `Projected ${delay}d slip` : "Tracking to plan"}
          </div>
        </div>
      </section>
    </div>
  );
}

// directivesByActionId: map of actionId → directive (from parent)
// onSendDirective: async (action) => void
// sendingActionIds: Set<string>
export function CommandTab({ dashboard, role, directivesByActionId, onSendDirective, sendingActionIds }) {
  if (!dashboard) {
    return <p className="message">No dashboard data available.</p>;
  }

  if (role === "client") {
    return <ClientView dashboard={dashboard} />;
  }

  return (
    <div className="command-dashboard">
      <HeroStrip dashboard={dashboard} />
      <CausePanel cause={dashboard.cause} />
      <ActionPanel
        action={dashboard.action}
        directivesByActionId={directivesByActionId ?? {}}
        onSend={onSendDirective ?? (() => {})}
        sending={sendingActionIds ?? new Set()}
      />
      <ExecutionPanel execution={dashboard.execution} />
      <ForecastPanel forecast={dashboard.forecast} />
    </div>
  );
}
