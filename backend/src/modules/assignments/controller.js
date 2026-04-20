import {
  acceptAssignment,
  completeAssignment,
  createAssignmentOffer,
  declineAssignment,
  getAssignmentDetails,
  listAssignments,
  startAssignment
} from "./service.js";

export async function createAssignmentController(req, res, next) {
  try {
    const assignment = await createAssignmentOffer(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

export async function listAssignmentsController(req, res, next) {
  try {
    const assignments = await listAssignments(req.auth);
    return res.json({ success: true, data: assignments });
  } catch (error) {
    return next(error);
  }
}

export async function getAssignmentController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const assignment = await getAssignmentDetails(id, req.auth);
    return res.json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

export async function acceptAssignmentController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const assignment = await acceptAssignment(id, req.auth.userId);
    return res.json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

export async function declineAssignmentController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const assignment = await declineAssignment(id, req.auth.userId);
    return res.json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

export async function startAssignmentController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const assignment = await startAssignment(id, req.auth.userId);
    return res.json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}

export async function completeAssignmentController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const assignment = await completeAssignment(id, req.auth);
    return res.json({ success: true, data: assignment });
  } catch (error) {
    return next(error);
  }
}
