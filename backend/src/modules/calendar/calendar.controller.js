import { createCalendarEventEntry, getCalendarEvents } from "./calendar.service.js";

export async function listCalendarEventsController(req, res, next) {
  try {
    const jobId = req.query.jobId ? Number.parseInt(req.query.jobId, 10) : null;
    const data  = await getCalendarEvents(jobId);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function createCalendarEventController(req, res, next) {
  try {
    const data = await createCalendarEventEntry(req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
