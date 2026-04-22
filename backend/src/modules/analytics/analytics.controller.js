import { getJobCommand } from "./analytics.service.js";
import { getJobActivitySnapshot, getJobFinancialSnapshot } from "./analytics.repository.js";

export async function getJobCommandController(req, res, next) {
  try {
    // 🔥 CONSTRUCTION PROJECT COMMAND (merged best of both)
    const jobId = Number.parseInt(req.params.id, 10);
    
    // Validate job ID
    if (isNaN(jobId) || jobId <= 0) {
      const error = new Error("Invalid job ID");
      error.statusCode = 400;
      throw error;
    }

    // 🔥 AUTHORIZED COMMAND GENERATION
    const command = await getJobCommand(jobId, req.auth);
    
    return res.json({ 
      success: true, 
      data: command,
      jobId,
      timestamp: new Date().toISOString(),
      userRole: req.auth.role
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = "Failed to generate project command";
    }
    return next(error);
  }
}

export async function getFinancialSnapshotController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    if (isNaN(jobId) || jobId <= 0) {
      const error = new Error("Invalid job ID");
      error.statusCode = 400;
      throw error;
    }
    const snapshot = await getJobFinancialSnapshot(jobId);
    return res.json({ success: true, data: snapshot, jobId });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}

export async function getJobActivitySnapshotController(req, res, next) {
  try {
    const jobId = Number.parseInt(req.params.id, 10);
    if (isNaN(jobId) || jobId <= 0) {
      const error = new Error("Invalid job ID");
      error.statusCode = 400;
      throw error;
    }
    const snapshot = await getJobActivitySnapshot(jobId, req.auth?.userId);
    return res.json({ success: true, data: snapshot, jobId });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    return next(error);
  }
}