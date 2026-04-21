import { runAutofill } from "./assembler.service.js";

export async function autofillController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      const err = new Error("Invalid job ID");
      err.statusCode = 400;
      throw err;
    }

    const { timeoutMinutes } = req.body ?? {};
    const result = await runAutofill(jobId, req.auth.userId, { timeoutMinutes });

    return res.status(200).json({
      success: true,
      data: result,
      jobId,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}
