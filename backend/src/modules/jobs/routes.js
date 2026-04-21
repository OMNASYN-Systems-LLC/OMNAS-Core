import { Router } from "express";
import { createJobController, deleteJobController, getJobByIdController, listJobsController, updateJobController } from "./controller.js";
import { requireAuth, requireRole } from "../../middleware/authContext.js";

export const jobsRouter = Router();

jobsRouter.use(requireAuth);
jobsRouter.post("/", requireRole("contractor"), createJobController);
jobsRouter.get("/", listJobsController);
jobsRouter.get("/:id", getJobByIdController);
jobsRouter.patch("/:id", requireRole("contractor"), updateJobController);
jobsRouter.delete("/:id", requireRole("contractor"), deleteJobController);
