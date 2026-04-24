import { getJobSchedule } from "./service.js";

export async function getJobScheduleController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const data = await getJobSchedule(jobId, req.auth.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
