import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "trade_adjacency.json");

const taxonomy = JSON.parse(readFileSync(configPath, "utf-8"));

export function normalizeTrade(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCanonicalTrade(value) {
  const normalized = normalizeTrade(value);

  if (!normalized) {
    return "";
  }

  for (const [core, aliases] of Object.entries(taxonomy.core_trade || {})) {
    if (core === normalized || (Array.isArray(aliases) && aliases.includes(normalized))) {
      return core;
    }
  }

  return normalized;
}

export function getComplianceStatus(targetTrade, workerTradeSet) {
  const normalizedTarget = getCanonicalTrade(targetTrade);
  const exclusion = taxonomy.exclusions?.[normalizedTarget];

  if (!exclusion) {
    return {
      complianceStatus: "compliant",
      requiresLicensedTrade: false,
      blocked: false
    };
  }

  const isDirect = workerTradeSet.has(normalizedTarget);

  return {
    complianceStatus: isDirect ? "compliant" : "requires_certified_trade",
    requiresLicensedTrade: true,
    blocked: !isDirect
  };
}

export function getTradeFit(targetTrade, workerTrades) {
  const normalizedTarget = getCanonicalTrade(targetTrade);
  const normalizedWorkerTrades = new Set([...workerTrades].map(getCanonicalTrade).filter(Boolean));

  if (!normalizedTarget) {
    return { tradeFitType: "incidental", tradeFitScore: 0.4, targetTrade: normalizedTarget };
  }

  if (normalizedWorkerTrades.has(normalizedTarget)) {
    return { tradeFitType: "direct", tradeFitScore: 1.0, targetTrade: normalizedTarget };
  }

  const adjacentWeight = taxonomy.adjacencies?.[normalizedTarget] || {};
  const adjacentMatch = Object.keys(adjacentWeight).find((trade) => normalizedWorkerTrades.has(trade));
  if (adjacentMatch) {
    return {
      tradeFitType: "adjacent",
      tradeFitScore: Number(adjacentWeight[adjacentMatch] ?? 0.75),
      targetTrade: normalizedTarget
    };
  }

  const incidentals = taxonomy.incidental_trades?.[normalizedTarget] || [];
  if (incidentals.some((trade) => normalizedWorkerTrades.has(trade))) {
    return { tradeFitType: "incidental", tradeFitScore: 0.4, targetTrade: normalizedTarget };
  }

  return { tradeFitType: "incidental", tradeFitScore: 0.4, targetTrade: normalizedTarget };
}
