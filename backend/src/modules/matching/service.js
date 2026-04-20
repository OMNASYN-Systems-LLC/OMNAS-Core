import { getJobWithRequirements, listWorkersForMatching, replaceMatchScores } from "./repository.js";
import { assertNonNegativeInteger } from "../../utils/validation.js";

function round(value) {
  return Math.round(value * 100) / 100;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function computeSkillScore(requiredSkills, workerSkills) {
  if (requiredSkills.length === 0) {
    return { skill_score: 0, proficiency_bonus: 0 };
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

  const skillScore = totalWeight === 0 ? 0 : (matchedWeight / totalWeight) * 70;
  const proficiencyBonus = totalWeight === 0 ? 0 : (proficiencyAccumulator / totalWeight) * 20;

  return {
    skill_score: round(skillScore),
    proficiency_bonus: round(proficiencyBonus)
  };
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

export async function getJobMatches(jobId, contractorUserId) {
  assertNonNegativeInteger(jobId, "jobId");

  const job = await getJobWithRequirements(jobId, contractorUserId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const { workers, workerSkills, workerAvailability } = await listWorkersForMatching();

  const matches = workers.map((worker) => {
    const skills = workerSkills.filter((item) => item.worker_user_id === worker.user_id);
    const availability = workerAvailability.filter((item) => item.worker_user_id === worker.user_id);

    const { skill_score, proficiency_bonus } = computeSkillScore(job.requiredSkills, skills);
    const availability_score = computeAvailabilityScore(job, availability);
    const location_score = computeLocationScore(job, worker);
    const total_score = round(skill_score + proficiency_bonus + availability_score + location_score);

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
      score: total_score,
      total_score,
      score_breakdown: {
        skill_score,
        availability_score,
        location_score,
        total_score
      }
    };
  });

  const sortedMatches = matches.sort((a, b) => b.total_score - a.total_score);
  await replaceMatchScores(jobId, sortedMatches);

  return sortedMatches;
}
