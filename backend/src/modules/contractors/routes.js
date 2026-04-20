import { Router } from "express";
import { getContractorProfileController, upsertContractorProfileController } from "./controller.js";
import { requireAuth, requireRole } from "../../middleware/authContext.js";

export const contractorRouter = Router();

contractorRouter.use(requireAuth, requireRole("contractor"));
contractorRouter.put("/profile", upsertContractorProfileController);
contractorRouter.get("/profile", getContractorProfileController);
