import { Link } from "react-router-dom";

const STATUS_COLORS = {
  healthy: "#22c55e",
  caution: "#eab308",
  warning: "#f97316",
  critical: "#ef4444"
};

const PRIORITY_COLORS = {
  high: "#ef4444",
  medium: "#eab308",
  low: "#22c55e",
  info: "#64748b"
};

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num}${suffix}`;
}

function HeroBar({ health, financial, job }) {
  const color = STATUS_COLORS[health?.status] ?? STATUS_COLORS.warning;
  const score = health?.score ?? 0;
  const status = (health?.status ?? "unknown").toUpperCase();
  const dailyLoss = financial?.dailyLoss;

  return (
    <section className="command-hero" style={{ borderLeft: `8px solid ${color}` }}>
      <div className="command-hero-score">
        <div className="command-hero-score-value" style={{ color }}>
          {score}
        </div>
        <div className="command-hero-score-label">HEALTH</div>
      </div>
      <div className="command-hero-meta">
        <div className="command-hero-status" style={{ color }}>
          {status}
        </div>
        {job ? <div className="command-hero-title">{job.title}</div> : null}
        {dailyLoss !== null && dailyLoss !== undefined && dailyLoss > 0 ? (
          <div className="command-hero-loss">
            Project losing <strong>{formatCurrency(dailyLoss)}/day</strong>
          </div>
        ) : (
          <div className="command-hero-loss command-hero-loss-stable">On plan — no measurable daily loss</div>
        )}
      </div>
    </section>
  );
}

function Panel({ title, tone = "neutral", children }) {
  return (
    <section className={`command-panel command-panel-${tone}`}>
      <h3 className="command-panel-title">{title}</h3>
      <div className="command-panel-body">{children}</div>
    </section>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`command-metric command-metric-${tone ?? "neutral"}`}>
      <div className="command-metric-value">{value}</div>
      <div className="command-metric-label">{label}</div>
    </div>
  );
}

function FinancialPanel({ financial }) {
  if (!financial) {
    return <Panel title="Financial Impact"><p className="command-empty">No financial data available.</p></Panel>;
  }

  const tone = financial.dailyLoss > 0 ? "warning" : "healthy";

  return (
    <Panel title="Financial Impact" tone={tone}>
      <div className="command-metric-row">
        <Metric label="Daily loss" value={formatCurrency(financial.dailyLoss)} tone={tone} />
        <Metric label="Weekly projection" value={formatCurrency(financial.weeklyProjection)} tone={tone} />
      </div>
      {financial.topDrivers && financial.topDrivers.length > 0 ? (
        <>
          <div className="command-subtitle">Top drivers</div>
          <ul className="command-list">
            {financial.topDrivers.map((driver, idx) => (
              <li key={idx}>
                <span className="command-list-label">{driver.label}</span>
                <span className="command-list-meta">{driver.metric}</span>
                {driver.impact !== undefined ? (
                  <span className="command-list-impact">{formatCurrency(driver.impact)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="command-empty">No material loss drivers detected.</p>
      )}
    </Panel>
  );
}

function ExecutionPanel({ execution }) {
  if (!execution) {
    return <Panel title="Execution Status"><p className="command-empty">No execution data.</p></Panel>;
  }

  const readiness = execution.readinessPercent ?? 0;
  const drift = execution.scheduleDriftDays ?? 0;
  const readinessTone = readiness >= 90 ? "healthy" : readiness >= 60 ? "caution" : "warning";
  const driftTone = drift === 0 ? "healthy" : drift > 3 ? "critical" : "warning";

  return (
    <Panel title="Execution Status">
      <div className="command-metric-row">
        <Metric label="Schedule drift" value={formatNumber(drift, " d")} tone={driftTone} />
        <Metric label="Readiness" value={`${readiness}%`} tone={readinessTone} />
        <Metric label="Open slots" value={formatNumber(execution.openSlots)} tone={execution.openSlots > 0 ? "warning" : "healthy"} />
      </div>
      <div className="command-progress">
        <div className="command-progress-fill" style={{ width: `${readiness}%`, background: STATUS_COLORS[readinessTone] }} />
      </div>
      {execution.missingWork?.silentWorkers?.length > 0 ? (
        <>
          <div className="command-subtitle">Silent workers</div>
          <ul className="command-list">
            {execution.missingWork.silentWorkers.map((w) => (
              <li key={w.assignmentId}>
                <span className="command-list-label">{w.workerName}</span>
                <span className="command-list-meta">{w.daysSilent} day(s) since last log</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}

function RisksPanel({ risks }) {
  if (!risks) {
    return <Panel title="Risks"><p className="command-empty">No risk data.</p></Panel>;
  }

  const any = risks.escalations + risks.hardLocks + risks.congestion + risks.safety > 0;

  return (
    <Panel title="Risks" tone={any ? "warning" : "healthy"}>
      <div className="command-metric-row">
        <Metric label="Escalations" value={formatNumber(risks.escalations)} tone={risks.escalations > 0 ? "warning" : "healthy"} />
        <Metric label="Hard locks" value={formatNumber(risks.hardLocks)} tone={risks.hardLocks > 0 ? "warning" : "healthy"} />
        <Metric label="Congestion" value={formatNumber(risks.congestion)} tone="neutral" />
        <Metric label="Safety" value={formatNumber(risks.safety)} tone={risks.safety > 0 ? "critical" : "healthy"} />
      </div>
    </Panel>
  );
}

function AutomationPanel({ automation }) {
  if (!automation) {
    return null;
  }

  return (
    <Panel title="Automation">
      <div className="command-metric-row">
        <Metric label="Auto-resolutions" value={formatNumber(automation.autoResolutions)} tone="healthy" />
        <Metric
          label="Pending overrides"
          value={formatNumber(automation.pendingOverrides)}
          tone={automation.pendingOverrides > 0 ? "caution" : "healthy"}
        />
      </div>
    </Panel>
  );
}

function ForecastPanel({ forecast }) {
  if (!forecast) {
    return <Panel title="Forecast"><p className="command-empty">No forecast.</p></Panel>;
  }

  const delay = forecast.projectedDelayDays ?? 0;
  const tone = delay === 0 ? "healthy" : delay > 5 ? "critical" : "warning";

  return (
    <Panel title="Forecast" tone={tone}>
      <div className="command-metric-row">
        <Metric label="Projected delay" value={formatNumber(delay, " d")} tone={tone} />
        <Metric label="Projected loss" value={formatCurrency(forecast.projectedLoss)} tone={tone} />
      </div>
    </Panel>
  );
}

function ActionQueue({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <Panel title="Action Queue" tone="healthy">
        <p className="command-empty">No decisions required.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Action Queue">
      <ul className="command-action-list">
        {actions.map((action) => (
          <li key={action.id} className={`command-action command-action-${action.priority}`}>
            <span
              className="command-action-dot"
              style={{ background: PRIORITY_COLORS[action.priority] ?? PRIORITY_COLORS.info }}
            />
            <span className="command-action-label">{action.label}</span>
            {action.cta ? (
              action.route ? (
                <Link to={action.route} className="command-action-cta">
                  {action.cta}
                </Link>
              ) : (
                <span className="command-action-cta command-action-cta-disabled">{action.cta}</span>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CommandTab({ command, role }) {
  if (!command) {
    return <p className="message">No command data available.</p>;
  }

  return (
    <div className="command-tab">
      <HeroBar health={command.health} financial={command.financial} job={command.job} />

      <div className="command-grid">
        <FinancialPanel financial={command.financial} />
        <ExecutionPanel execution={command.execution} />
        <RisksPanel risks={command.risks} />
        {role !== "client" ? <AutomationPanel automation={command.automation} /> : null}
        <ForecastPanel forecast={command.forecast} />
        <ActionQueue actions={command.actions} />
      </div>
    </div>
  );
}
