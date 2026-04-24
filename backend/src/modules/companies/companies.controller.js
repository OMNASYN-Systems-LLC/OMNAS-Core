import { claimCompany, getCompanies, getCompany, inviteCompany } from "./companies.service.js";

export async function inviteCompanyController(req, res, next) {
  try {
    const company = await inviteCompany(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: company });
  } catch (error) {
    return next(error);
  }
}

export async function claimCompanyController(req, res, next) {
  try {
    const result = await claimCompany(req.auth.userId, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getCompanyController(req, res, next) {
  try {
    const company = await getCompany(req.params.id);
    return res.json({ success: true, data: company });
  } catch (error) {
    return next(error);
  }
}

export async function listCompaniesController(req, res, next) {
  try {
    const companies = await getCompanies(req.query);
    return res.json({ success: true, data: companies });
  } catch (error) {
    return next(error);
  }
}
