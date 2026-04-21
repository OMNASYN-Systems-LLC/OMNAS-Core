import { getJobCommand } from "./analytics.service.js";

export async function getJobCommandController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const command = await getJobCommand(id, req.auth);
    return res.json({ success: true, data: command });
  } catch (error) {
    return next(error);
  }
}
