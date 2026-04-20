const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function buildHeaders(auth) {
  return {
    "Content-Type": "application/json",
    "x-user-id": auth.userId,
    "x-user-role": auth.role
  };
}

async function request(path, { method = "GET", payload, auth }) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: auth ? buildHeaders(auth) : { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function register(payload) {
  return request("/auth/register", { method: "POST", payload });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", payload });
}

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

export function getJobMatches(id, auth) {
  return request(`/jobs/${id}/matches`, { auth });
}
