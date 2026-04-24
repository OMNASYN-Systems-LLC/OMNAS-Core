import { Router } from "express";
import { listSkillsController } from "./controller.js";
import { requireAuth } from "../../middleware/authContext.js";

export const skillsRouter = Router();

skillsRouter.use(requireAuth);
skillsRouter.get("/", listSkillsController);
