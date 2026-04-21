import { getJobMatches } from "./service.js";

export async function getJobMatchesController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const matches = await getJobMatches(jobId, req.auth.userId);
    return res.json({ success: true, data: matches });
  } catch (error) {
    return next(error);
  }
}
