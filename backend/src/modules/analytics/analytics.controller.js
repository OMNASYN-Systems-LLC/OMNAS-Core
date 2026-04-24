import { getProjectCommand } from "./analytics.service.js";

export async function getProjectCommandController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const data = await getProjectCommand(jobId, req.auth.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
