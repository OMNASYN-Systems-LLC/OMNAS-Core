import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  createCompany,
  getCompany,
  getMyCompany,
  listCompanies,
  affiliateWorker,
  removeWorkerFromCompany,
  getWorkers
} from "./companies.service.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);

// POST /api/companies
// Register a new company. Contractor becomes owner. Compliance state seeded as PENDING.
// Use PATCH /api/compliance/companies/:id/status to promote to ACTIVE.
companiesRouter.post("/", requireRole("contractor"), async (req, res, next) => {
  try {
    const company = await createCompany(req.auth.userId, req.body);
    res.status(201).json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies
// Contractor: sees their own company only.
// Client / superintendent: sees all companies with compliance status.
companiesRouter.get("/", requireRole("contractor", "client", "superintendent"), async (req, res, next) => {
  try {
    if (req.auth.role === "contractor") {
      const company = await getMyCompany(req.auth.userId);
      return res.json({ success: true, data: company ? [company] : [] });
    }
    const data = await listCompanies();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/me
// Returns the calling contractor's own company with compliance state, or 404.
// Must be declared before /:id so Express doesn't swallow "me" as a UUID param.
companiesRouter.get("/me", requireRole("contractor"), async (req, res, next) => {
  try {
    const company = await getMyCompany(req.auth.userId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "No company registered. POST /api/companies to create one."
      });
    }
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:id
// Returns company record joined with current compliance state and active worker count.
companiesRouter.get("/:id", requireRole("contractor", "client", "superintendent"), async (req, res, next) => {
  try {
    const data = await getCompany(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:id/workers
// Lists all affiliated workers (all statuses) with profile info.
companiesRouter.get("/:id/workers", requireRole("contractor", "client", "superintendent"), async (req, res, next) => {
  try {
    const data = await getWorkers(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:id/workers
// Affiliate a worker with this company. Contractor (owner) only.
// Body: { workerUserId: UUID, role?: "member" | "foreman" | "super" }
companiesRouter.post("/:id/workers", requireRole("contractor"), async (req, res, next) => {
  try {
    const data = await affiliateWorker(req.params.id, req.auth.userId, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/companies/:id/workers/:workerId
// Soft-removes a worker affiliation (status → 'removed').
// Compliance checks clear automatically since they filter on status = 'active'.
companiesRouter.delete("/:id/workers/:workerId", requireRole("contractor"), async (req, res, next) => {
  try {
    const data = await removeWorkerFromCompany(req.params.id, req.auth.userId, req.params.workerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
