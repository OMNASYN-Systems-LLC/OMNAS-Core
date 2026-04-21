import { getDashboardJobActivity } from "../dashboard/dashboard.repository.js";

// Deprecated shim for compatibility.
export async function getJobActivitySnapshot(jobId, contractorUserId) {
  return getDashboardJobActivity(jobId, contractorUserId);
}
