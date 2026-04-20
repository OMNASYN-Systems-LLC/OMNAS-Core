import { getAssignmentLogs, getSingleLog, submitDailyLog, submitDailyLogEntry, submitVoiceLog } from "./service.js";

export async function submitDailyLogController(req, res, next) {
  try {
    const assignmentId = Number.parseInt(req.params.id, 10);
    const log = await submitDailyLog(assignmentId, req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    return next(error);
  }
}

export async function submitDailyLogEntryController(req, res, next) {
  try {
    const log = await submitDailyLogEntry(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    return next(error);
  }
}

export async function submitVoiceLogController(req, res, next) {
  try {
    const result = await submitVoiceLog(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getAssignmentLogsController(req, res, next) {
  try {
    const assignmentId = Number.parseInt(req.params.id, 10);
    const logs = await getAssignmentLogs(assignmentId, req.auth);
    return res.json({ success: true, data: logs });
  } catch (error) {
    return next(error);
  }
}

export async function getLogByIdController(req, res, next) {
  try {
    const logId = Number.parseInt(req.params.id, 10);
    const log = await getSingleLog(logId, req.auth);
    return res.json({ success: true, data: log });
  } catch (error) {
    return next(error);
  }
}
