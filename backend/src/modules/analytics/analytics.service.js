import { getProjectDashboard } from "../dashboard/dashboard.service.js";

// Deprecated shim: analytics command now aliases unified dashboard aggregation.
export async function getProjectCommand(jobId, contractorUserId) {
  return getProjectDashboard(jobId, contractorUserId);
}
