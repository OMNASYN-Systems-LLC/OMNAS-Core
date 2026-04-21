import { getJobErosion } from "./financial.service.js";

export async function getJobErosionController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const data = await getJobErosion(jobId, req.auth.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
