import { assertRequiredFields } from "../../utils/validation.js";
import {
  claimCompanyByInviteToken,
  createCompanyInvite,
  createDefaultSoloCompanyShell,
  findPrimaryAffiliationByWorker,
  getCompanyById,
  getCompanyByInviteToken,
  listCompanies,
  upsertWorkerAffiliation
} from "./companies.repository.js";

function withCompliancePending(company) {
  return {
    ...company,
    compliance_status: "PENDING"
  };
}

export async function inviteCompany(userId, payload) {
  assertRequiredFields(payload, ["legalName"]);
  const company = await createCompanyInvite({
    legalName: payload.legalName,
    dbaName: payload.dbaName,
    taxId: payload.taxId,
    invitedBy: userId
  });

  return withCompliancePending(company);
}

export async function claimCompany(userId, payload) {
  assertRequiredFields(payload, ["inviteToken"]);

  const invited = await getCompanyByInviteToken(payload.inviteToken);
  if (!invited) {
    const error = new Error("Invite token is invalid or has already been claimed");
    error.statusCode = 404;
    throw error;
  }

  const company = await claimCompanyByInviteToken(payload.inviteToken, userId);
  const affiliation = await upsertWorkerAffiliation({
    userId,
    companyId: company.id,
    role: payload.role ?? "OWNER",
    status: "ACTIVE"
  });

  return { company, affiliation };
}

export async function ensureSoloCompany(userId) {
  const current = await findPrimaryAffiliationByWorker(userId);
  if (current) {
    return { companyId: current.company_id, created: false };
  }

  const shell = await createDefaultSoloCompanyShell({ userId });
  await upsertWorkerAffiliation({ userId, companyId: shell.id, role: "OWNER", status: "ACTIVE" });

  return { companyId: shell.id, created: true };
}

export async function getCompany(companyId) {
  const company = await getCompanyById(companyId);
  if (!company) {
    const error = new Error("Company not found");
    error.statusCode = 404;
    throw error;
  }

  return withCompliancePending(company);
}

export async function getCompanies(query) {
  const limit = query.limit ? Number.parseInt(query.limit, 10) : 50;
  const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;

  return listCompanies({ status: query.status, limit, offset });
}
