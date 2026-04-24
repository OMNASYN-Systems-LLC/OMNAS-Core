import { initDispatch, rerunDispatch } from "./orchestrator.service.js";

export async function autofillJobController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const result = await initDispatch(jobId, req.auth.userId);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function rerunAutofillController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    const result = await rerunDispatch(jobId, req.auth.userId, req.body || {});
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}
