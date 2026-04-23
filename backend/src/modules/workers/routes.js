import { Router } from "express";
import {
  addWorkerSkillController,
  getWorkerProfileController,
  removeWorkerSkillController,
  upsertWorkerProfileController
} from "./controller.js";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  listWorkerCredentials,
  insertCredential,
  deleteCredential
} from "./repository.js";

export const workerRouter = Router();

workerRouter.use(requireAuth, requireRole("worker"));
workerRouter.put("/profile", upsertWorkerProfileController);
workerRouter.get("/profile", getWorkerProfileController);
workerRouter.post("/skills", addWorkerSkillController);
workerRouter.delete("/skills/:skillId", removeWorkerSkillController);

// GET /api/workers/credentials — list the calling worker's credentials
workerRouter.get("/credentials", async (req, res, next) => {
  try {
    const data = await listWorkerCredentials(req.auth.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/workers/credentials — add a credential
// Body: { credentialType, credentialId?, issuedAt?, expiresAt?, verified? }
workerRouter.post("/credentials", async (req, res, next) => {
  try {
    const { credentialType } = req.body ?? {};
    if (!credentialType) {
      return res.status(400).json({ success: false, message: "credentialType is required" });
    }
    const credential = await insertCredential(req.auth.userId, req.body);
    res.status(201).json({ success: true, data: credential });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workers/credentials/:id — remove a credential (own records only)
workerRouter.delete("/credentials/:id", async (req, res, next) => {
  try {
    const removed = await deleteCredential(req.params.id, req.auth.userId);
    if (!removed) {
      return res.status(404).json({ success: false, message: "Credential not found" });
    }
    res.json({ success: true, data: removed });
  } catch (err) {
    next(err);
  }
});
