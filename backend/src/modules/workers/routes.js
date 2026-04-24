import { Router } from "express";
import {
  addWorkerSkillController,
  getWorkerProfileController,
  removeWorkerSkillController,
  upsertWorkerProfileController
} from "./controller.js";
import { requireAuth, requireRole } from "../../middleware/authContext.js";

export const workerRouter = Router();

workerRouter.use(requireAuth, requireRole("worker"));
workerRouter.put("/profile", upsertWorkerProfileController);
workerRouter.get("/profile", getWorkerProfileController);
workerRouter.post("/skills", addWorkerSkillController);
workerRouter.delete("/skills/:skillId", removeWorkerSkillController);
