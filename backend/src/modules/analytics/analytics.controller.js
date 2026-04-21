import { getJobCommand } from "./analytics.service.js"; // ✅ Consistent naming

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
    // 🔥 PRODUCTION ERROR HANDLING
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = "Failed to generate project command";
    }
    return next(error);
  }
}