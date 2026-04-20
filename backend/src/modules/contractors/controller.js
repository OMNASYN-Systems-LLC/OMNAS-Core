import { createOrUpdateContractorProfile, getContractorProfileByUser } from "./service.js";

export async function upsertContractorProfileController(req, res, next) {
  try {
    const profile = await createOrUpdateContractorProfile(req.auth.userId, req.body);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function getContractorProfileController(req, res, next) {
  try {
    const profile = await getContractorProfileByUser(req.auth.userId);
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
}
