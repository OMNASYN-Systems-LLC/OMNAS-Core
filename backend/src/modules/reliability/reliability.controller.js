import { getReliabilityProfile } from "./reliability.service.js";

export async function getWorkerReliabilityController(req, res, next) {
  try {
    const workerUserId = req.params.id;
    if (!workerUserId) {
      const err = new Error("Worker ID is required");
      err.statusCode = 400;
      throw err;
    }

    const profile = await getReliabilityProfile(workerUserId);
    return res.json({ success: true, data: profile });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}
