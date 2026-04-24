import { getProjectDashboard, getTriageDashboard } from "./dashboard.service.js";

export async function getProjectDashboardController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const data = await getProjectDashboard(jobId, req.auth.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}


export async function getTriageDashboardController(req, res, next) {
  try {
    const data = await getTriageDashboard(req.auth.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
