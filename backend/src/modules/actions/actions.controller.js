import {
  draftAndSendDirective,
  getDirectivesForJob,
  setDirectiveStatus,
} from "./actions.service.js";

export async function draftDirectiveController(req, res, next) {
  try {
    const result = await draftAndSendDirective(req.body, req.auth);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}

export async function listDirectivesController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.query.jobId, 10);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      const err = new Error("jobId query parameter is required and must be a positive integer");
      err.statusCode = 400;
      throw err;
    }
    const directives = await getDirectivesForJob(jobId);
    return res.json({ success: true, data: directives });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}

export async function updateDirectiveStatusController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      const err = new Error("Invalid directive ID");
      err.statusCode = 400;
      throw err;
    }
    const { status } = req.body;
    const directive = await setDirectiveStatus(id, status);
    return res.json({ success: true, data: directive });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}
