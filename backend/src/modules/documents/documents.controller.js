import {
  uploadDocument,
  getDocument,
  listProjectDocuments,
  addDocumentVersion,
  linkDocumentToEntity,
  reviewDocument,
} from "./documents.service.js";

export async function uploadDocumentController(req, res, next) {
  try {
    const result = await uploadDocument(req.body || {}, req.auth);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getDocumentController(req, res, next) {
  try {
    const data = await getDocument(req.params.id, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function listProjectDocumentsController(req, res, next) {
  try {
    const data = await listProjectDocuments(req.params.projectId, req.auth);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function addDocumentVersionController(req, res, next) {
  try {
    const result = await addDocumentVersion(req.params.id, req.body || {}, req.auth);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function linkDocumentController(req, res, next) {
  try {
    const result = await linkDocumentToEntity(req.params.id, req.body || {}, req.auth);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function reviewDocumentController(req, res, next) {
  try {
    const result = await reviewDocument(req.params.id, req.body || {}, req.auth);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}
