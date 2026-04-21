import { getJobDashboard } from "./dashboard.service.js";

export async function getJobDashboardController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);

    if (!Number.isFinite(jobId) || jobId <= 0) {
      const err = new Error("Invalid job ID");
      err.statusCode = 400;
      throw err;
    }

    const dashboard = await getJobDashboard(jobId, req.auth);

    return res.json({
      success: true,
      data: dashboard,
      jobId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = "Failed to generate dashboard";
    }
    return next(error);
  }
}
