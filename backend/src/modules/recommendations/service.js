import { assertNonNegativeInteger } from "../../utils/validation.js";
import { getComplianceStatus, getTradeFit, normalizeTrade } from "../pca/taxonomy/tradeIntelligence.js";
import { getJobForRecommendations, listAssignedWorkerIds, listWorkersForRecommendations } from "./repository.js";

const COMPONENT_WEIGHTS = {
  skill_specificity_score: 0.35,
  reliability_score: 0.25,
  availability_score: 0.15,
  proximity_score: 0.15,
  experience_score: 0.1
};

function round(value) {
  return Math.round(value * 100) / 100;
}

function extractInsightsCategories(job) {
  const insights = job.metadata?.procurement_insights || {};
  const source = Array.isArray(insights.categories) ? insights.categories : [];

  return source
    .map((entry) => ({
      category: normalizeTrade(entry?.category),
      confidence: Number(entry?.confidence ?? 0)
    }))
    .filter((entry) => entry.category && entry.confidence > 0.5)
    .sort((a, b) => b.confidence - a.confidence);
}

function deriveGaps(requiredCategories, assignedCategories) {
  const assignedSet = new Set(assignedCategories);

  return requiredCategories
    .filter((entry) => !assignedSet.has(entry.category))
    .map((entry) => ({
      category: entry.category,
      severity: entry.confidence >= 0.75 ? "high" : "medium"
    }));
}

function buildAssignedCategories(workers, workerSkills, assignedWorkerIds) {
  const assignedSet = new Set(assignedWorkerIds);
  const categories = new Set();

  for (const worker of workers) {
    if (!assignedSet.has(worker.user_id)) {
      continue;
    }

    categories.add(normalizeTrade(worker.trade_primary));

    for (const skill of workerSkills) {
      if (skill.worker_user_id === worker.user_id) {
        categories.add(normalizeTrade(skill.category || skill.label || skill.code));
      }
    }
  }

  categories.delete("");
  return [...categories];
}

function computeSkillSpecificityScore(workerCategories, workerSkills, gapCategory, categoryConfidence) {
  const categoryMatch = workerCategories.has(gapCategory) ? 1 : 0;

  const skillSignals = workerSkills
    .filter((skill) => {
      const bucket = [skill.category, skill.label, skill.code].map(normalizeTrade);
      return bucket.includes(gapCategory);
    })
    .map((skill) => (Number(skill.proficiency) / 5) * 0.7 + (Math.min(Number(skill.years || 0), 10) / 10) * 0.3);

  const skillSpecificity = skillSignals.length > 0 ? Math.max(...skillSignals) : 0;
  const raw = categoryMatch * 0.6 + skillSpecificity * 0.4;

  return round(Math.min(1, raw) * Math.max(0.25, Math.min(1, categoryConfidence)));
}

function computeReliabilityScore(perf) {
  const totalAssignments = Number(perf?.total_assignments || 0);
  const completed = Number(perf?.total_jobs_completed || 0);
  const completionRate = totalAssignments > 0 ? completed / totalAssignments : 0;
  const expectedLogs = Math.max(1, completed * 2);
  const logConsistency = Math.min(1, Number(perf?.logs_count || 0) / expectedLogs);
  const completedNormalized = Math.min(1, completed / 10);

  return round(completedNormalized * 0.35 + completionRate * 0.4 + logConsistency * 0.25);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function computeAvailabilityScore(job, windows) {
  if (windows.length === 0) {
    return 0;
  }

  const now = new Date();
  const jobStart = new Date(job.starts_at);
  const jobEnd = new Date(job.ends_at);

  let hasCurrentOverlap = false;
  let hasFutureOverlap = false;

  for (const window of windows) {
    const start = new Date(window.available_start);
    const end = new Date(window.available_end);

    if (overlaps(start, end, jobStart, jobEnd)) {
      hasFutureOverlap = true;
      if (overlaps(start, end, now, now)) {
        hasCurrentOverlap = true;
      }
    }
  }

  if (hasCurrentOverlap) {
    return 1;
  }

  if (hasFutureOverlap) {
    return 0.65;
  }

  return 0;
}

function zipPrefix(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : "";
}

function computeProximityScore(jobZip, workerZip) {
  if (!jobZip || !workerZip) {
    return 0.2;
  }

  if (String(jobZip) === String(workerZip)) {
    return 1;
  }

  if (zipPrefix(jobZip) && zipPrefix(jobZip) === zipPrefix(workerZip)) {
    return 0.6;
  }

  return 0.25;
}

function computeExperienceScore(yearsExperience) {
  return round(Math.min(10, Math.max(0, Number(yearsExperience || 0))) / 10);
}

function aggregateWorkerCategories(worker, skills) {
  const categories = new Set();

  categories.add(normalizeTrade(worker.trade_primary));

  for (const skill of skills) {
    categories.add(normalizeTrade(skill.category));
    categories.add(normalizeTrade(skill.label));
    categories.add(normalizeTrade(skill.code));
  }

  categories.delete("");
  return categories;
}

function computeFitScore({ skill, reliability, availability, proximity, experience }, tradeFitScore) {
  const weighted =
    skill * COMPONENT_WEIGHTS.skill_specificity_score +
    reliability * COMPONENT_WEIGHTS.reliability_score +
    availability * COMPONENT_WEIGHTS.availability_score +
    proximity * COMPONENT_WEIGHTS.proximity_score +
    experience * COMPONENT_WEIGHTS.experience_score;

  return round(weighted * tradeFitScore * 100);
}

export async function getJobRecommendations(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const job = await getJobForRecommendations(jobId, contractorUserId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const requiredCategories = extractInsightsCategories(job);
  if (requiredCategories.length === 0) {
    return { jobId, gapRecommendations: [] };
  }

  const assignedWorkerIds = await listAssignedWorkerIds(jobId);
  const assignedData = await listWorkersForRecommendations([]);
  const assignedCategorySnapshot = buildAssignedCategories(assignedData.workers, assignedData.workerSkills, assignedWorkerIds);

  const gaps = deriveGaps(requiredCategories, assignedCategorySnapshot);
  if (gaps.length === 0) {
    return { jobId, gapRecommendations: [] };
  }

  const workerData = await listWorkersForRecommendations(assignedWorkerIds);
  const performanceMap = new Map(workerData.performance.map((row) => [row.worker_user_id, row]));

  const gapRecommendations = gaps.map((gap) => {
    const categoryConfidence = requiredCategories.find((entry) => entry.category === gap.category)?.confidence ?? 0.5;
    const gapCompliance = getComplianceStatus(gap.category, new Set());

    const topRecommendations = workerData.workers
      .map((worker) => {
        const skills = workerData.workerSkills.filter((entry) => entry.worker_user_id === worker.user_id);
        const availability = workerData.availability.filter((entry) => entry.worker_user_id === worker.user_id);
        const workerCategories = aggregateWorkerCategories(worker, skills);
        const tradeFit = getTradeFit(gap.category, workerCategories);
        const compliance = getComplianceStatus(gap.category, workerCategories);

        const rationale = {
          skill: computeSkillSpecificityScore(workerCategories, skills, gap.category, categoryConfidence),
          reliability: computeReliabilityScore(performanceMap.get(worker.user_id)),
          availability: round(computeAvailabilityScore(job, availability)),
          proximity: round(computeProximityScore(job.site_zip, worker.home_zip)),
          experience: computeExperienceScore(worker.years_experience)
        };

        return {
          workerId: worker.user_id,
          workerName: `${worker.first_name} ${worker.last_name}`.trim(),
          fitScore: compliance.blocked ? 0 : computeFitScore(rationale, tradeFit.tradeFitScore),
          tradeFitType: tradeFit.tradeFitType,
          complianceStatus: compliance.complianceStatus,
          requiresLicensedTrade: compliance.requiresLicensedTrade,
          rationale,
          bestFitForGap: false,
          blockedByCompliance: compliance.blocked
        };
      })
      .filter((entry) => !entry.blockedByCompliance)
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 5)
      .map((entry, index) => ({ ...entry, bestFitForGap: index === 0 }));

    return {
      category: gap.category,
      severity: gap.severity,
      complianceStatus: gapCompliance.complianceStatus,
      requiresLicensedTrade: gapCompliance.requiresLicensedTrade,
      topRecommendations
    };
  });

  return {
    jobId,
    gapRecommendations
  };
}
