import {
  addWorkerSkill,
  getWorkerProfile,
  getWorkerSkills,
  removeWorkerSkill,
  upsertWorkerProfile
} from "./repository.js";
import { assertIntegerInRange, assertNonNegativeInteger, assertRequiredFields } from "../../utils/validation.js";

export async function createOrUpdateWorkerProfile(userId, payload) {
  assertRequiredFields(payload, ["firstName", "lastName", "tradePrimary", "yearsExperience"]);
  assertNonNegativeInteger(payload.yearsExperience, "yearsExperience");

  if (payload.travelRadiusMi !== undefined) {
    assertNonNegativeInteger(payload.travelRadiusMi, "travelRadiusMi");
  }

  if (payload.ratingAvg !== undefined && (Number(payload.ratingAvg) < 0 || Number(payload.ratingAvg) > 5)) {
    const error = new Error("ratingAvg must be between 0 and 5");
    error.statusCode = 400;
    throw error;
  }

  return upsertWorkerProfile(userId, payload);
}

export async function addSkillToWorker(userId, payload) {
  assertRequiredFields(payload, ["skillId", "proficiency", "years"]);
  assertNonNegativeInteger(payload.skillId, "skillId");
  assertIntegerInRange(payload.proficiency, "proficiency", 1, 5);
  assertNonNegativeInteger(payload.years, "years");

  return addWorkerSkill(userId, payload.skillId, {
    proficiency: payload.proficiency,
    years: payload.years,
    verified: Boolean(payload.verified)
  });
}

export async function removeSkillFromWorker(userId, skillId) {
  assertNonNegativeInteger(skillId, "skillId");

  const removed = await removeWorkerSkill(userId, skillId);
  if (!removed) {
    const error = new Error("Worker skill not found");
    error.statusCode = 404;
    throw error;
  }
}

export async function getWorkerProfileWithSkills(userId) {
  const profile = await getWorkerProfile(userId);

  if (!profile) {
    const error = new Error("Worker profile not found");
    error.statusCode = 404;
    throw error;
  }

  const skills = await getWorkerSkills(userId);
  return { ...profile, skills };
}
