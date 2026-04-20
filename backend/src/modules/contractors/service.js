import { getContractorProfile, upsertContractorProfile } from "./repository.js";
import { assertRequiredFields } from "../../utils/validation.js";

export async function createOrUpdateContractorProfile(userId, payload) {
  assertRequiredFields(payload, ["companyName", "licenseNumber"]);

  if (payload.bondingLimit !== undefined && Number(payload.bondingLimit) < 0) {
    const error = new Error("bondingLimit must be non-negative");
    error.statusCode = 400;
    throw error;
  }

  return upsertContractorProfile(userId, payload);
}

export async function getContractorProfileByUser(userId) {
  const profile = await getContractorProfile(userId);

  if (!profile) {
    const error = new Error("Contractor profile not found");
    error.statusCode = 404;
    throw error;
  }

  return profile;
}
