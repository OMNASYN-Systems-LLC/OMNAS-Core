import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { fetchOpportunitiesController } from "./controller.js";

export const opportunitiesRouter = Router();

opportunitiesRouter.use(requireAuth, requireRole("contractor"));
opportunitiesRouter.post("/fetch", fetchOpportunitiesController);
