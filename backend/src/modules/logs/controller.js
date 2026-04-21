// 🔥 FULL IMPORTS (merged both branches)
import { 
  getAssignmentLogs, 
  getSingleLog, 
  submitDailyLog, 
  submitDailyLogEntry, 
  submitVoiceLog 
} from "./service.js";

// 🔥 DAILY LOG SUBMISSION (form-based - office verified)
export async function submitDailyLogController(req, res, next) {
  try {
    const assignmentId = Number.parseInt(req.params.id, 10);
    
    // Validate assignment ID
    if (isNaN(assignmentId) || assignmentId <= 0) {
      const error = new Error("Invalid assignment ID");
      error.statusCode = 400;
      throw error;
    }

    const log = await submitDailyLog(assignmentId, req.auth.userId, req.body);
    return res.status(201).json({ 
      success: true, 
      data: log,
      message: "Daily log submitted successfully"
    });
  } catch (error) {
    return next(error);
  }
}

// 🔥 EXECUTION LOG ENTRY (programmatic - mobile apps)
export async function submitDailyLogEntryController(req, res, next) {
  try {
    const log = await submitDailyLogEntry(req.auth.userId, req.body);
    return res.status(201).json({ 
      success: true, 
      data: log,
      message: "Execution log entry created"
    });
  } catch (error) {
    return next(error);
  }
}

// 🔥 VOICE LOGGING (AI-powered field capture - CONSTRUCTION KILLER!)
export async function submitVoiceLogController(req, res, next) {
  try {
    const result = await submitVoiceLog(req.auth.userId, req.body);
    return res.status(201).json({ 
      success: true, 
      data: result,
      message: "Voice log processed with AI insights",
      detectedCategories: result.prefill?.detected_categories || [],
      confidence: result.draft?.confidence || 0
    });
  } catch (error) {
    return next(error);
  }
}

// 🔥 ASSIGNMENT LOGS LISTING
export async function getAssignmentLogsController(req, res, next) {
  try {
    const assignmentId = Number.parseInt(req.params.id, 10);
    
    if (isNaN(assignmentId) || assignmentId <= 0) {
      const error = new Error("Invalid assignment ID");
      error.statusCode = 400;
      throw error;
    }

    const logs = await getAssignmentLogs(assignmentId, req.auth);
    return res.json({ 
      success: true, 
      data: logs,
      count: logs.length,
      message: `Found ${logs.length} logs for assignment`
    });
  } catch (error) {
    return next(error);
  }
}

// 🔥 SINGLE LOG RETRIEVAL
export async function getLogByIdController(req, res, next) {
  try {
    const logId = Number.parseInt(req.params.id, 10);
    
    if (isNaN(logId) || logId <= 0) {
      const error = new Error("Invalid log ID");
      error.statusCode = 400;
      throw error;
    }

    const log = await getSingleLog(logId, req.auth);
    return res.json({ 
      success: true, 
      data: log,
      message: "Log retrieved successfully"
    });
  } catch (error) {
    return next(error);
  }
}