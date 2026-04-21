import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobRecommendationsController } from "./controller.js";

export const recommendationsRouter = Router();

recommendationsRouter.use(requireAuth, requireRole("contractor"));
recommendationsRouter.get("/:id/recommendations", getJobRecommendationsController);
