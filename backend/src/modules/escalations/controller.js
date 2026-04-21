import { getEscalationQueue, recordEscalationDecision } from "./service.js";

export async function listEscalationsController(req, res, next) {
  try {
    const status = String(req.query.status || "pending");
    const data = await getEscalationQueue(status);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function resolveEscalationController(req, res, next) {
  try {
    const escalationId = Number.parseInt(req.params.id, 10);
    const { decision, note } = req.body || {};
    const data = await recordEscalationDecision(escalationId, decision, note);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
