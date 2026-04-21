import { getComplianceStatus, getTradeFit, normalizeTrade } from "../pca/taxonomy/tradeIntelligence.js";
import { getJobWithRequirements, listWorkerPerformance, listWorkersForMatching, replaceMatchScores } from "./repository.js";
import { assertNonNegativeInteger } from "../../utils/validation.js";

function round(value) {
  return Math.round(value * 100) / 100;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function computeSkillScore(requiredSkills, workerSkills) {
  if (requiredSkills.length === 0) {
    return 0;
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  let proficiencyAccumulator = 0;

  for (const req of requiredSkills) {
    const weight = req.required ? 2 : 1;
    totalWeight += weight;

    const workerSkill = workerSkills.find((s) => Number(s.skill_id) === Number(req.skill_id));
    if (workerSkill) {
      matchedWeight += weight;
      const proficiencyDelta = Number(workerSkill.proficiency) - Number(req.min_proficiency);
      proficiencyAccumulator += Math.max(0, Math.min(1, 1 + proficiencyDelta / 5)) * weight;
    }
  }

  const coverage = totalWeight === 0 ? 0 : matchedWeight / totalWeight;
  const proficiency = totalWeight === 0 ? 0 : proficiencyAccumulator / totalWeight;

  return round(coverage * 55 + proficiency * 20);
}

function computeAvailabilityScore(job, availabilityWindows) {
  const jobStart = new Date(job.starts_at);
  const jobEnd = new Date(job.ends_at);

  const hasOverlap = availabilityWindows.some((window) =>
    overlaps(new Date(window.available_start), new Date(window.available_end), jobStart, jobEnd)
  );

  return hasOverlap ? 10 : 0;
}

function computeLocationScore(job, worker) {
  return job.site_zip && worker.home_zip && job.site_zip === worker.home_zip ? 10 : 0;
}

function computePerformanceScore(performance) {
  const totalAssignments = Number(performance?.total_assignments ?? 0);
  const totalCompleted = Number(performance?.total_jobs_completed ?? 0);
  const totalHours = Number(performance?.total_hours_logged ?? 0);
  const avgHours = Number(performance?.avg_hours_per_day ?? 0);
  const stddev = Number(performance?.hours_stddev ?? 0);
  const logsCount = Number(performance?.logs_count ?? 0);

  const completionRate = totalAssignments > 0 ? totalCompleted / totalAssignments : 0;
  const consistency = Math.max(0, 1 - stddev / 8);
  const logReliability = totalAssignments > 0 ? Math.min(1, logsCount / totalAssignments) : 0;

  const score = completionRate * 12 + consistency * 4 + logReliability * 4;

  return {
    performance_score: round(score),
    metrics: {
      total_jobs_completed: totalCompleted,
      total_hours_logged: round(totalHours),
      completion_rate: round(completionRate),
      avg_hours_per_day: round(avgHours)
    }
  };
}

function getJobCategories(job) {
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

function getWorkerCategorySet(worker, skills) {
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

function computeTradeAdjacency(jobCategories, workerCategories) {
  if (jobCategories.length === 0) {
    return {
      trade_adjacency_score: 0,
      tradeFitType: "incidental",
      complianceStatus: "compliant",
      requiresLicensedTrade: false
    };
  }

  let best = {
    score: 0,
    tradeFitType: "incidental",
    complianceStatus: "compliant",
    requiresLicensedTrade: false
  };

  for (const jobCategory of jobCategories) {
    const fit = getTradeFit(jobCategory.category, workerCategories);
    const compliance = getComplianceStatus(jobCategory.category, workerCategories);

    if (compliance.blocked) {
      continue;
    }

    const weightedScore = fit.tradeFitScore * 10 * jobCategory.confidence;
    if (weightedScore > best.score) {
      best = {
        score: weightedScore,
        tradeFitType: fit.tradeFitType,
        complianceStatus: compliance.complianceStatus,
        requiresLicensedTrade: compliance.requiresLicensedTrade
      };
    }
  }

  return {
    trade_adjacency_score: round(best.score),
    tradeFitType: best.tradeFitType,
    complianceStatus: best.complianceStatus,
    requiresLicensedTrade: best.requiresLicensedTrade
  };
}

export async function getJobMatches(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const job = await getJobWithRequirements(jobId, contractorUserId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const { workers, workerSkills, workerAvailability } = await listWorkersForMatching();
  const performanceRows = await listWorkerPerformance();
  const perfByWorker = new Map();

  for (const row of performanceRows.assignments) {
    perfByWorker.set(row.worker_user_id, { ...row });
  }

  for (const row of performanceRows.hours) {
    perfByWorker.set(row.worker_user_id, { ...(perfByWorker.get(row.worker_user_id) || {}), ...row });
  }

  const jobCategories = getJobCategories(job);

  const matches = workers.map((worker) => {
    const skills = workerSkills.filter((item) => item.worker_user_id === worker.user_id);
    const availability = workerAvailability.filter((item) => item.worker_user_id === worker.user_id);

    const skill_score = computeSkillScore(job.requiredSkills, skills);
    const availability_score = computeAvailabilityScore(job, availability);
    const location_score = computeLocationScore(job, worker);
    const { performance_score, metrics } = computePerformanceScore(perfByWorker.get(worker.user_id));

    const workerCategories = getWorkerCategorySet(worker, skills);
    const tradeFit = computeTradeAdjacency(jobCategories, workerCategories);
    const total_score = round(skill_score + availability_score + location_score + performance_score + tradeFit.trade_adjacency_score);

    return {
      worker_user_id: worker.user_id,
      worker_name: `${worker.first_name} ${worker.last_name}`,
      skills: skills.map((skill) => ({
        skill_id: skill.skill_id,
        label: skill.label,
        code: skill.code,
        category: skill.category,
        proficiency: skill.proficiency,
        years: skill.years,
        verified: skill.verified
      })),
      performance: metrics,
      score: total_score,
      total_score,
      performance_score,
      tradeFitType: tradeFit.tradeFitType,
      complianceStatus: tradeFit.complianceStatus,
      requiresLicensedTrade: tradeFit.requiresLicensedTrade,
      score_breakdown: {
        skill_score,
        availability_score,
        location_score,
        performance_score,
        trade_adjacency_score: tradeFit.trade_adjacency_score,
        total_score
      }
    };
  });

  const sortedMatches = matches.sort((a, b) => b.total_score - a.total_score);
  await replaceMatchScores(jobId, sortedMatches);

  return sortedMatches;
}
