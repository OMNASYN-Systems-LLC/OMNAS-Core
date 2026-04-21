import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobErosionController } from "./financial.controller.js";

export const financialRouter = Router();

financialRouter.use(requireAuth, requireRole("contractor"));
financialRouter.get("/:id/erosion", getJobErosionController);
