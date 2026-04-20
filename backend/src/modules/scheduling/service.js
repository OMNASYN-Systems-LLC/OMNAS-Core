import { assertNonNegativeInteger } from "../../utils/validation.js";
import { getComplianceStatus, getTradeFit, normalizeTrade } from "../pca/taxonomy/tradeIntelligence.js";
import { getJobRecommendations } from "../recommendations/service.js";
import { getJobSchedulingContext } from "./repository.js";
import { runFieldToPlanAudit } from "./audit.service.js";

const TASK_PHASES = ["rough-in", "install", "test", "closeout"];

function extractRequiredCategories(job) {
  const insights = job.metadata?.procurement_insights || {};
  const categories = Array.isArray(insights.categories) ? insights.categories : [];

  return categories
    .map((item) => ({
      category: normalizeTrade(item?.category),
      confidence: Number(item?.confidence ?? 0)
    }))
    .filter((item) => item.category && item.confidence > 0.5)
    .sort((a, b) => b.confidence - a.confidence);
}

function buildWorkerCategorySet(workerId, assignments, workerSkills) {
  const categories = new Set();
  const assignment = assignments.find((item) => item.worker_user_id === workerId);

  if (assignment?.trade_primary) {
    categories.add(normalizeTrade(assignment.trade_primary));
  }

  for (const skill of workerSkills) {
    if (skill.worker_user_id === workerId) {
      categories.add(normalizeTrade(skill.category));
      categories.add(normalizeTrade(skill.label));
      categories.add(normalizeTrade(skill.code));
    }
  }

  categories.delete("");
  return categories;
}

function evaluateCoverage(requiredCategories, assignments, workerSkills) {
  const tradeCoverage = requiredCategories.map((required) => {
    const assignedWorkers = assignments
      .filter((assignment) => ["accepted", "active", "completed"].includes(assignment.status))
      .map((assignment) => {
        const workerCategories = buildWorkerCategorySet(assignment.worker_user_id, assignments, workerSkills);
        const tradeFit = getTradeFit(required.category, workerCategories);
        const compliance = getComplianceStatus(required.category, workerCategories);

        return {
          workerId: assignment.worker_user_id,
          workerName: `${assignment.first_name} ${assignment.last_name}`.trim(),
          assignmentStatus: assignment.status,
          tradeFitType: tradeFit.tradeFitType,
          complianceStatus: compliance.complianceStatus,
          requiresLicensedTrade: compliance.requiresLicensedTrade,
          valid: !compliance.blocked && (tradeFit.tradeFitType === "direct" || tradeFit.tradeFitType === "adjacent")
        };
      });

    const directCoverage = assignedWorkers.some((worker) => worker.valid && worker.tradeFitType === "direct");
    const adjacentCoverage = assignedWorkers.some((worker) => worker.valid && worker.tradeFitType === "adjacent");
    const blockedCoverage = assignedWorkers.some((worker) => worker.complianceStatus === "requires_certified_trade");

    const coverageStatus = directCoverage ? "direct" : adjacentCoverage ? "adjacent" : blockedCoverage ? "blocked" : "missing";

    return {
      category: required.category,
      confidence: required.confidence,
      coverageStatus,
      workers: assignedWorkers
    };
  });

  return tradeCoverage;
}

function computeReadiness(tradeCoverage) {
  if (tradeCoverage.length === 0) {
    return "NOT_READY";
  }

  const hasBlocked = tradeCoverage.some((entry) => entry.coverageStatus === "blocked");
  const hasMissing = tradeCoverage.some((entry) => entry.coverageStatus === "missing");
  const hasAdjacent = tradeCoverage.some((entry) => entry.coverageStatus === "adjacent");

  if (hasBlocked || hasMissing) {
    return "NOT_READY";
  }

  if (hasAdjacent) {
    return "AT_RISK";
  }

  return "READY";
}

function buildComplianceWarnings(tradeCoverage) {
  return tradeCoverage
    .filter((entry) => entry.coverageStatus === "blocked")
    .map((entry) => ({
      category: entry.category,
      message: `Category ${entry.category} requires certified trade coverage.`
    }));
}

function buildGaps(tradeCoverage) {
  return tradeCoverage
    .filter((entry) => entry.coverageStatus === "missing" || entry.coverageStatus === "blocked")
    .map((entry) => ({
      category: entry.category,
      severity: entry.coverageStatus === "blocked" ? "high" : "medium",
      reason: entry.coverageStatus === "blocked" ? "Trade is restricted and assigned workers are not compliant." : "No valid worker coverage for required trade."
    }));
}

function buildTaskMapping(categories) {
  return categories.map((entry) => ({
    category: entry.category,
    phases: TASK_PHASES
  }));
}

function buildLookahead(requiredCategories, tradeCoverage, recommendationResponse) {
  const gapMap = new Map((recommendationResponse.gapRecommendations || []).map((gap) => [gap.category, gap]));

  const week1 = tradeCoverage
    .filter((entry) => entry.coverageStatus === "direct")
    .map((entry) => ({
      category: entry.category,
      source: "assigned",
      taskPhases: TASK_PHASES
    }));

  const week2 = tradeCoverage
    .filter((entry) => entry.coverageStatus === "adjacent" || entry.coverageStatus === "missing")
    .map((entry) => {
      const gap = gapMap.get(entry.category);
      const best = gap?.topRecommendations?.[0] || null;

      return {
        category: entry.category,
        source: "recommended",
        recommendedWorkerId: best?.workerId || null,
        recommendedWorkerName: best?.workerName || null,
        taskPhases: TASK_PHASES
      };
    });

  const week3 = requiredCategories
    .filter((required) => {
      const coverage = tradeCoverage.find((entry) => entry.category === required.category);
      return !coverage || coverage.coverageStatus === "missing" || coverage.coverageStatus === "blocked";
    })
    .map((required) => ({
      category: required.category,
      source: "remaining_scope",
      taskPhases: TASK_PHASES
    }));

  return {
    week1,
    week2,
    week3,
    taskMapping: buildTaskMapping(requiredCategories)
  };
}

export async function getJobSchedule(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const context = await getJobSchedulingContext(jobId, contractorUserId);
  if (!context) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const requiredCategories = extractRequiredCategories(context.job);
  const tradeCoverage = evaluateCoverage(requiredCategories, context.assignments, context.workerSkills);
  const readinessStatus = computeReadiness(tradeCoverage);
  const complianceWarnings = buildComplianceWarnings(tradeCoverage);
  const gaps = buildGaps(tradeCoverage);
  const recommendations = await getJobRecommendations(jobId, contractorUserId);
  const lookahead = buildLookahead(requiredCategories, tradeCoverage, recommendations);

  const audit = runFieldToPlanAudit({
    jobId,
    schedule: { ...lookahead, jobStartsAt: context.job.starts_at },
    logs: context.logs || [],
    assignments: context.assignments || [],
    pcaCategories: requiredCategories,
    weatherInput: context.job.metadata?.weather || null
  });

  return {
    readinessStatus,
    complianceWarnings,
    gaps,
    lookahead,
    tradeCoverage,
    audit
  };
}
