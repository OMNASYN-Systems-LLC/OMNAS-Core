import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  listAllCompanies,
  getCompanyComplianceStatus,
  setCompanyStatus,
  getHistory
} from "./compliance.service.js";

export const complianceRouter = Router();

complianceRouter.use(requireAuth);
complianceRouter.use(requireRole("contractor", "superintendent", "client"));

// GET /api/compliance/companies
// List all companies with their current compliance status.
complianceRouter.get("/companies", async (req, res, next) => {
  try {
    const data = await listAllCompanies();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/compliance/companies/:id
// Get the current compliance state for a single company.
complianceRouter.get("/companies/:id", async (req, res, next) => {
  try {
    const state = await getCompanyComplianceStatus(req.params.id);
    if (!state) {
      return res.status(404).json({ success: false, message: "No compliance record found for this company" });
    }
    res.json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
});

// GET /api/compliance/companies/:id/history
// Get the full compliance state-change history for a company.
complianceRouter.get("/companies/:id/history", async (req, res, next) => {
  try {
    const data = await getHistory(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/compliance/companies/:id/status
// Set a company's compliance status. Restricted to contractors and superintendents.
// Body: { status: "PENDING" | "ACTIVE" | "SUSPENDED", reason?: string, reasonCode?: string }
complianceRouter.patch(
  "/companies/:id/status",
  requireRole("contractor", "superintendent"),
  async (req, res, next) => {
    try {
      const { status, reason, reasonCode } = req.body ?? {};
      if (!status) {
        return res.status(400).json({ success: false, message: "status is required" });
      }
      const state = await setCompanyStatus(req.params.id, status, {
        reason:     reason     ?? null,
        reasonCode: reasonCode ?? null,
        changedBy:  req.auth.userId
      });
      res.json({ success: true, data: state });
    } catch (err) {
      next(err);
    }
  }
);
