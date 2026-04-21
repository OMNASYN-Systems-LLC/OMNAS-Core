import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { autofillController } from "./assembler.controller.js";

export const assemblerRouter = Router();

assemblerRouter.use(requireAuth);
assemblerRouter.use(requireRole("contractor"));

// POST /api/jobs/:id/autofill
assemblerRouter.post("/:id/autofill", autofillController);
