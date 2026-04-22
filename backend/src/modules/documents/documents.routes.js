import { Router } from "express";
import { requireAuth } from "../../middleware/authContext.js";
import {
  uploadDocumentController,
  getDocumentController,
  listProjectDocumentsController,
  addDocumentVersionController,
  linkDocumentController,
  reviewDocumentController,
} from "./documents.controller.js";

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

// Static-segment routes BEFORE parameterised /:id to prevent shadowing
// GET /api/docs/project/:projectId — list documents for a job/project
documentsRouter.get("/project/:projectId", listProjectDocumentsController);

// POST /api/docs — upload new document (role check enforced in service)
documentsRouter.post("/", uploadDocumentController);

// GET /api/docs/:id — get document with versions, reviews, and links
documentsRouter.get("/:id", getDocumentController);

// POST /api/docs/:id/versions — add a new version (resets status to UPLOADED)
documentsRouter.post("/:id/versions", addDocumentVersionController);

// POST /api/docs/:id/links — link document to any entity
documentsRouter.post("/:id/links", linkDocumentController);

// POST /api/docs/:id/review — review and transition document status
documentsRouter.post("/:id/review", reviewDocumentController);
