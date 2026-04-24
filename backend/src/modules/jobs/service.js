import { createJob, deleteJob, getJobById, getJobSkills, listJobs, updateJob } from "./repository.js";
import { assertIntegerInRange, assertNonNegativeInteger, assertRequiredFields } from "../../utils/validation.js";

function validateRequiredSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    const error = new Error("At least one required skill is mandatory");
    error.statusCode = 400;
    throw error;
  }

  for (const skill of skills) {
    assertRequiredFields(skill, ["skillId", "minProficiency"]);
    assertNonNegativeInteger(skill.skillId, "requiredSkills.skillId");
    assertIntegerInRange(skill.minProficiency, "requiredSkills.minProficiency", 1, 5);
  }
}

function validateDates(payload) {
  const startsAt = new Date(payload.startsAt);
  const endsAt = new Date(payload.endsAt);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    const error = new Error("startsAt and endsAt must be valid ISO date strings");
    error.statusCode = 400;
    throw error;
  }

  if (endsAt < startsAt) {
    const error = new Error("endsAt must be later than or equal to startsAt");
    error.statusCode = 400;
    throw error;
  }
}

export async function createJobPosting(postedBy, payload) {
  assertRequiredFields(payload, ["organizationId", "title", "description", "startsAt", "endsAt", "payRate"]);
  validateRequiredSkills(payload.requiredSkills);
  validateDates(payload);

  if (Number(payload.payRate) < 0) {
    const error = new Error("payRate must be non-negative");
    error.statusCode = 400;
    throw error;
  }

  return createJob(postedBy, payload);
}

export async function listJobsForContractor(postedBy) {
  return listJobs(postedBy);
}

export async function getJobDetails(id, postedBy) {
  assertNonNegativeInteger(id, "id");

  const job = await getJobById(id, postedBy);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const skills = await getJobSkills(id);
  return { ...job, requiredSkills: skills };
}

export async function updateJobPosting(id, postedBy, payload) {
  assertNonNegativeInteger(id, "id");

  if (payload.requiredSkills !== undefined) {
    validateRequiredSkills(payload.requiredSkills);
  }

  if (payload.startsAt !== undefined && payload.endsAt !== undefined) {
    validateDates(payload);
  }

  const job = await updateJob(id, postedBy, payload);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  return job;
}

export async function removeJobPosting(id, postedBy) {
  assertNonNegativeInteger(id, "id");

  const removed = await deleteJob(id, postedBy);
  if (!removed) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }
}
