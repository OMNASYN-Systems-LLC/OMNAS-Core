import {
  insertCompany,
  findCompanyById,
  findCompanyByOwner,
  listAllCompanies,
  upsertWorkerAffiliation,
  softRemoveAffiliation,
  listCompanyWorkers
} from "./companies.repository.js";

const VALID_ROLES = ["member", "foreman", "super"];

// Register a new company. The calling contractor becomes the owner.
// Pilot constraint: one company per contractor — enforced here before insert.
export async function createCompany(ownerUserId, payload) {
  const name = (payload?.name ?? "").trim();
  if (!name) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }

  const existing = await findCompanyByOwner(ownerUserId);
  if (existing) {
    const err = new Error("Contractor already has a registered company. Use PATCH /api/compliance/companies/:id/status to manage its state.");
    err.statusCode = 409;
    throw err;
  }

  return insertCompany({
    name,
    licenseNumber: payload?.licenseNumber ?? null,
    ownerUserId
  });
}

export async function getCompany(companyId) {
  const company = await findCompanyById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.statusCode = 404;
    throw err;
  }
  return company;
}

// Returns the calling contractor's own company or null if not yet registered.
export async function getMyCompany(ownerUserId) {
  return findCompanyByOwner(ownerUserId);
}

export async function listCompanies() {
  return listAllCompanies();
}

// Affiliate a worker with a company. Only the company owner may call this.
// Role defaults to 'member'. Re-affiliating a removed worker reactivates them.
export async function affiliateWorker(companyId, ownerUserId, payload) {
  const workerUserId = payload?.workerUserId;
  if (!workerUserId) {
    const err = new Error("workerUserId is required");
    err.statusCode = 400;
    throw err;
  }

  const role = (payload?.role ?? "member").toLowerCase();
  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`role must be one of: ${VALID_ROLES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const company = await findCompanyById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.statusCode = 404;
    throw err;
  }
  if (company.owner_user_id !== ownerUserId) {
    const err = new Error("Only the company owner can manage worker affiliations");
    err.statusCode = 403;
    throw err;
  }

  return upsertWorkerAffiliation({ companyId, workerUserId, role });
}

// Soft-removes a worker affiliation. Blocked check-ins will clear automatically
// because getWorkerCompanyCompliance filters on status = 'active'.
export async function removeWorkerFromCompany(companyId, ownerUserId, workerUserId) {
  const company = await findCompanyById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.statusCode = 404;
    throw err;
  }
  if (company.owner_user_id !== ownerUserId) {
    const err = new Error("Only the company owner can manage worker affiliations");
    err.statusCode = 403;
    throw err;
  }

  const removed = await softRemoveAffiliation(companyId, workerUserId);
  if (!removed) {
    const err = new Error("Worker affiliation not found or already removed");
    err.statusCode = 404;
    throw err;
  }
  return removed;
}

export async function getWorkers(companyId) {
  return listCompanyWorkers(companyId);
}
