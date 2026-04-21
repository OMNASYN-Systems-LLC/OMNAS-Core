import { Link } from "react-router-dom";

const TONE = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  neutral: "#64748b",
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

function ActionPanel({ action }) {
  const list = action ?? [];
  const urgent = list.filter((a) => ["high", "critical"].includes(a.priority));
  const suggested = list.filter((a) => !["high", "critical"].includes(a.priority) && a.id !== "all-clear");
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
            <ul className="action-list">
              {suggested.map((a) => (
                <li key={a.id} className="action-item">
                  <span className="action-text">{a.label}</span>
                  {a.cta ? <ActionButton action={a} variant="ghost" /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="action-col action-col-approval">
          <div className="action-col-title">Needs your approval</div>
          {urgent.length === 0 ? (
            <p className="dash-empty">No pending approvals.</p>
          ) : (
            <ul className="action-list">
              {urgent.map((a) => (
                <li key={a.id} className="action-item action-item-urgent">
                  <span className="action-text">{a.label}</span>
                  {a.cta ? <ActionButton action={a} variant="primary" /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ActionButton({ action, variant }) {
  if (action.route) {
    return (
      <Link to={action.route} className={`action-btn action-btn-${variant}`}>
        {action.cta}
      </Link>
    );
  }
  return (
    <span className={`action-btn action-btn-${variant} action-btn-disabled`}>
      {action.cta}
    </span>
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

export function CommandTab({ dashboard, role }) {
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
      <ActionPanel action={dashboard.action} />
      <ExecutionPanel execution={dashboard.execution} />
      <ForecastPanel forecast={dashboard.forecast} />
    </div>
  );
}
