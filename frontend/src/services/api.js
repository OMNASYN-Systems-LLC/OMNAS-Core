const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function buildHeaders(auth) {
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": auth.userId,
    "x-user-role": auth.role
  };
  if (auth.companyId) headers["x-company-id"] = auth.companyId;
  return headers;
}

async function request(path, { method = "GET", payload, auth }) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: auth ? buildHeaders(auth) : { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (response.status === 204) return null;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

// 🔥 AUTHENTICATION
export function register(payload) {
  return request("/auth/register", { method: "POST", payload });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", payload });
}

// 🔥 PROFILES & SKILLS
export function listSkills(auth) {
  return request("/skills", { auth });
}

export function upsertWorkerProfile(payload, auth) {
  return request("/workers/profile", { method: "PUT", payload, auth });
}

export function getWorkerProfile(auth) {
  return request("/workers/profile", { auth });
}

export function addWorkerSkill(payload, auth) {
  return request("/workers/skills", { method: "POST", payload, auth });
}

export function removeWorkerSkill(skillId, auth) {
  return request(`/workers/skills/${skillId}`, { method: "DELETE", auth });
}

export function upsertContractorProfile(payload, auth) {
  return request("/contractors/profile", { method: "PUT", payload, auth });
}

export function getContractorProfile(auth) {
  return request("/contractors/profile", { auth });
}

// 🔥 JOBS (CRUD + Analytics - merged both branches!)
export function createJob(payload, auth) {
  return request("/jobs", { method: "POST", payload, auth });
}

export function listJobs(auth) {
  return request("/jobs", { auth });
}

export function getJob(id, auth) {
  return request(`/jobs/${id}`, { auth });
}

export function updateJob(id, payload, auth) {
  return request(`/jobs/${id}`, { method: "PATCH", payload, auth });
}

export function deleteJob(id, auth) {
  return request(`/jobs/${id}`, { method: "DELETE", auth });
}

// 🔥 JOB INTELLIGENCE (construction SOTA!)
export function getJobMatches(id, auth) {
  return request(`/jobs/${id}/matches`, { auth });
}

export function getJobRecommendations(id, auth) {
  return request(`/jobs/${id}/recommendations`, { auth });
}

export function getJobSchedule(id, auth) {
  return request(`/jobs/${id}/schedule`, { auth });
}

export function getJobErosion(id, auth) {
  return request(`/jobs/${id}/erosion`, { auth });
}

export function getJobCommand(id, auth) {
  return request(`/jobs/${id}/command`, { auth });
}

export function getJobDashboard(id, auth) {
  return request(`/jobs/${id}/dashboard`, { auth });
}

// 🔥 ACTIONS / DIRECTIVES
export function draftDirective(payload, auth) {
  return request("/actions/draft", { method: "POST", payload, auth });
}

export function listDirectives(jobId, auth) {
  return request(`/actions?jobId=${jobId}`, { auth });
}

export function updateDirectiveStatus(id, status, auth) {
  return request(`/actions/${id}/status`, { method: "PATCH", payload: { status }, auth });
}

// 🔥 ASSIGNMENTS
export function createAssignment(payload, auth) {
  return request("/assignments", { method: "POST", payload, auth });
}

export function listAssignments(auth) {
  return request("/assignments", { auth });
}

export function getAssignment(id, auth) {
  return request(`/assignments/${id}`, { auth });
}

export function acceptAssignment(id, auth) {
  return request(`/assignments/${id}/accept`, { method: "PATCH", auth });
}

export function declineAssignment(id, auth) {
  return request(`/assignments/${id}/decline`, { method: "PATCH", auth });
}

export function startAssignment(id, auth) {
  return request(`/assignments/${id}/start`, { method: "PATCH", auth });
}

export function completeAssignment(id, auth) {
  return request(`/assignments/${id}/complete`, { method: "PATCH", auth });
}

// 🔥 LOGGING (voice + execution - merged!)
export function submitDailyLog(assignmentId, payload, auth) {
  return request(`/assignments/${assignmentId}/logs`, { method: "POST", payload, auth });
}

export function getAssignmentLogs(assignmentId, auth) {
  return request(`/assignments/${assignmentId}/logs`, { auth });
}

export function getLog(id, auth) {
  return request(`/logs/${id}`, { auth });
}

// 🔥 FIELD LOGGING SUPERPOWERS
export function submitDailyExecutionLog(payload, auth) {
  return request("/logs/daily", { method: "POST", payload, auth });
}

export function submitVoiceLog(payload, auth) {
  return request("/logs/voice", { method: "POST", payload, auth });
}

// 🔥 OPPORTUNITIES
export function listReadyOpportunities(auth) {
  return request("/opportunities/ready", { auth });
}

export function importOpportunityToJob(id, auth) {
  return request(`/opportunities/${id}/import`, { method: "POST", auth });
}

// 🔥 ESCALATIONS (construction safety/compliance)
export function listEscalations(auth, status = "pending") {
  return request(`/escalations?status=${encodeURIComponent(status)}`, { auth });
}

export function decideEscalation(id, payload, auth) {
  return request(`/escalations/${id}/decision`, { method: "POST", payload, auth });
}

// TRIAGE
export function getTriageSummary(auth) {
  return request("/dashboard/triage", { auth });
}

export function getBlockLog(entityType, entityId, auth) {
  return request(`/dashboard/triage/blocks/${entityType}/${entityId}`, { auth });
}

// COMPLIANCE OVERRIDES
export function createComplianceOverride(payload, auth) {
  return request("/compliance/overrides", { method: "POST", payload, auth });
}

export function listComplianceOverrides(params = {}, auth) {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return request(`/compliance/overrides${qs ? `?${qs}` : ""}`, { auth });
}

// WORKER CREDENTIALS
export function listWorkerCredentials(auth) {
  return request("/workers/credentials", { auth });
}

export function addWorkerCredential(payload, auth) {
  return request("/workers/credentials", { method: "POST", payload, auth });
}

export function deleteWorkerCredential(id, auth) {
  return request(`/workers/credentials/${id}`, { method: "DELETE", auth });
}

// COMPANIES
export function createCompany(payload, auth) {
  return request("/companies", { method: "POST", payload, auth });
}

export function getMyCompany(auth) {
  return request("/companies/me", { auth });
}

export function affiliateWorker(companyId, payload, auth) {
  return request(`/companies/${companyId}/workers`, { method: "POST", payload, auth });
}

export function setCompanyComplianceStatus(companyId, payload, auth) {
  return request(`/compliance/companies/${companyId}/status`, { method: "PATCH", payload, auth });
}