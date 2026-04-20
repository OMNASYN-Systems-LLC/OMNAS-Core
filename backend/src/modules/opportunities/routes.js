import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  enrichOpportunitiesController,
  fetchOpportunitiesController,
  importOpportunityController,
  listReadyOpportunitiesController,
  normalizeOpportunitiesController
} from "./controller.js";

export const opportunitiesRouter = Router();

opportunitiesRouter.use(requireAuth, requireRole("contractor"));
opportunitiesRouter.post("/fetch", fetchOpportunitiesController);
opportunitiesRouter.post("/normalize", normalizeOpportunitiesController);
opportunitiesRouter.post("/enrich", enrichOpportunitiesController);
opportunitiesRouter.get("/ready", listReadyOpportunitiesController);
opportunitiesRouter.post("/:id/import", importOpportunityController);
