import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { autofillJobController, rerunAutofillController } from "./controller.js";

export const assemblerRouter = Router();

assemblerRouter.use(requireAuth, requireRole("contractor"));
assemblerRouter.post("/:id/autofill", autofillJobController);
assemblerRouter.post("/:id/autofill/rerun", rerunAutofillController);
