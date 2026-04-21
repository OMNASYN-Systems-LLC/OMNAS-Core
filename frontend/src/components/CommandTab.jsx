import { Link } from "react-router-dom";

const TONE = {
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  neutral: "#64748b"
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
      if (n >= 85) return "green";
      if (n >= 70) return "yellow";
      return "red";
    case "readiness":
      if (n >= 90) return "green";
      if (n >= 60) return "yellow";
      return "red";
    case "production":
      if (n >= 90) return "green";
      if (n >= 70) return "yellow";
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
    notation: compact ? "compact" : "standard"
  });
}

function plainScheduleStatus(driftDays, phase) {
  if (driftDays === 0) return "On Plan";
  if (phase === "not-started") return `${driftDays}d late to start`;
  if (phase === "overrun") return `${driftDays}d past completion`;
  return `${driftDays}d behind plan`;
}

function plainConfidence(score) {
  if (score >= 85) return "Likely to hit deadline";
  if (score >= 70) return "Tight — needs attention";
  return "Unlikely to hit deadline";
}

function HeroStrip({ command }) {
  const dailyLoss = command.financial?.dailyLoss ?? 0;
  const weeklyLoss = command.financial?.weeklyProjection ?? 0;
  const drift = command.execution?.scheduleDriftDays ?? 0;
  const phase = command.execution?.phase;
  const confidence = command.health?.score ?? 0;
  const topDriver = command.financial?.topDrivers?.[0];

  const lossTone = toneFor("loss", dailyLoss);
  const driftTone = toneFor("drift", drift);
  const confTone = toneFor("confidence", confidence);

  return (
    <section className="hero-strip">
      <div
        className={`hero-cell hero-loss tone-${lossTone}`}
        aria-label={`Profit loss ${formatCurrency(dailyLoss)} per day`}
      >
        <div className="hero-loss-value">{formatCurrency(dailyLoss)}</div>
        <div className="hero-loss-unit">per day</div>
        <div className="hero-loss-sub">
          {weeklyLoss > 0 ? `${formatCurrency(weeklyLoss)} this week` : "On budget this week"}
        </div>
        {topDriver ? (
          <div className="hero-loss-driver">Driven by {topDriver.label.toLowerCase()}</div>
        ) : null}
      </div>

      <div className={`hero-cell tone-${driftTone}`}>
        <div className="hero-secondary-label">Schedule Risk</div>
        <div className="hero-secondary-value">{drift === 0 ? "On Plan" : `+${drift}d`}</div>
        <div className="hero-secondary-sub">{plainScheduleStatus(drift, phase)}</div>
      </div>

      <div className={`hero-cell tone-${confTone}`}>
        <div className="hero-secondary-label">Confidence</div>
        <div className="hero-secondary-value">{confidence}%</div>
        <div className="hero-secondary-sub">{plainConfidence(confidence)}</div>
      </div>
    </section>
  );
}

function CausePanel({ drivers }) {
  const top = (drivers ?? []).slice(0, 3);
  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Why we're losing money</h3>
        <span className="dash-panel-sub">Top {top.length || 0} drivers</span>
      </header>
      {top.length === 0 ? (
        <p className="dash-empty">No material loss drivers detected.</p>
      ) : (
        <ol className="cause-list">
          {top.map((d, idx) => (
            <li key={idx} className="cause-row">
              <span className="cause-rank">{idx + 1}</span>
              <span className="cause-label">{d.label}</span>
              <span className="cause-impact">{formatCurrency(d.impact)}/day</span>
              <span className="cause-why">{d.metric}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActionPanel({ actions }) {
  const list = actions ?? [];
  const approvals = list.filter((a) => a.priority === "high");
  const recommendations = list.filter((a) => a.priority !== "high" && a.id !== "all-clear");
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
          {recommendations.length === 0 ? (
            <p className="dash-empty">No recommendations.</p>
          ) : (
            <ul className="action-list">
              {recommendations.map((a) => (
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
          {approvals.length === 0 ? (
            <p className="dash-empty">No pending approvals.</p>
          ) : (
            <ul className="action-list">
              {approvals.map((a) => (
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
  return <span className={`action-btn action-btn-${variant} action-btn-disabled`}>{action.cta}</span>;
}

function ExecutionPanel({ execution }) {
  const readiness = execution?.readinessPercent ?? 0;
  const required = execution?.requiredSlots ?? 0;
  const accepted = execution?.acceptedCount ?? 0;
  const conflicts = execution?.conflicts ?? 0;
  const productionPct = required > 0 ? Math.round((accepted / required) * 100) : 0;
  const readyTone = toneFor("readiness", readiness);
  const prodTone = toneFor("production", productionPct);
  const confTone = toneFor("conflicts", conflicts);

  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Execution</h3>
      </header>
      <div className="exec-row">
        <div className="exec-tile">
          <div className="exec-tile-label">Zone Readiness</div>
          <div className={`exec-tile-value tone-text-${readyTone}`}>{readiness}%</div>
          <div className="exec-bar">
            <div className={`exec-bar-fill tone-bg-${readyTone}`} style={{ width: `${readiness}%` }} />
          </div>
          <div className="exec-tile-sub">{accepted} of {required} slot(s) staffed</div>
        </div>

        <div className="exec-tile">
          <div className="exec-tile-label">Trade Conflicts</div>
          <div className={`exec-tile-value tone-text-${confTone}`}>{conflicts}</div>
          <div className="exec-tile-sub">{conflicts === 0 ? "No active conflicts" : `${conflicts} flagged`}</div>
        </div>

        <div className="exec-tile">
          <div className="exec-tile-label">Production vs Plan</div>
          <div className={`exec-tile-value tone-text-${prodTone}`}>{productionPct}%</div>
          <div className="exec-bar">
            <div className={`exec-bar-fill tone-bg-${prodTone}`} style={{ width: `${productionPct}%` }} />
          </div>
          <div className="exec-tile-sub">of planned output</div>
        </div>
      </div>
    </section>
  );
}

function ForecastPanel({ forecast }) {
  const delay = forecast?.projectedDelayDays ?? 0;
  const loss = forecast?.projectedLoss ?? 0;
  const delayTone = toneFor("drift", delay);
  const lossTone = toneFor("loss", loss);

  return (
    <section className="dash-panel">
      <header className="dash-panel-header">
        <h3>Forecast — if no action taken</h3>
      </header>
      <div className="forecast-row">
        <div className="forecast-cell">
          <div className="forecast-label">Projected delay</div>
          <div className={`forecast-value tone-text-${delayTone}`}>{delay}d</div>
        </div>
        <div className="forecast-cell">
          <div className="forecast-label">Projected loss</div>
          <div className={`forecast-value tone-text-${lossTone}`}>{formatCurrency(loss)}</div>
        </div>
      </div>
    </section>
  );
}

function ClientView({ command }) {
  const client = command.client ?? {};
  const confTone = toneFor("confidence", client.completionConfidence);
  const driftTone = toneFor("drift", command.forecast?.projectedDelayDays ?? 0);

  return (
    <div className="client-view">
      <section className="hero-strip">
        <div className={`hero-cell tone-${confTone}`}>
          <div className="hero-secondary-label">Completion Confidence</div>
          <div className="hero-secondary-value">{client.completionConfidence ?? 0}%</div>
          <div className="hero-secondary-sub">{plainConfidence(client.completionConfidence ?? 0)}</div>
        </div>
        <div className="hero-cell tone-green">
          <div className="hero-secondary-label">Verified Work Value</div>
          <div className="hero-secondary-value">{formatCurrency(client.verifiedWorkValue, { compact: true })}</div>
          <div className="hero-secondary-sub">
            {client.verifiedHours ? `${client.verifiedHours} hr verified` : "Awaiting first verified hours"}
          </div>
        </div>
        <div className={`hero-cell tone-${driftTone}`}>
          <div className="hero-secondary-label">Schedule Status</div>
          <div className="hero-secondary-value">{client.scheduleStatus ?? "—"}</div>
          <div className="hero-secondary-sub">
            {(command.forecast?.projectedDelayDays ?? 0) === 0
              ? "Tracking to plan"
              : `Projected ${command.forecast.projectedDelayDays}d slip`}
          </div>
        </div>
      </section>
    </div>
  );
}

export function CommandTab({ command, role }) {
  if (!command) {
    return <p className="message">No command data available.</p>;
  }

  if (role === "client") {
    return <ClientView command={command} />;
  }

  return (
    <div className="command-dashboard">
      <HeroStrip command={command} />
      <CausePanel drivers={command.financial?.topDrivers} />
      <ActionPanel actions={command.actions} />
      <ExecutionPanel execution={command.execution} />
      <ForecastPanel forecast={command.forecast} />
    </div>
  );
}
