import { createJobPosting, getJobDetails, listJobsForContractor, removeJobPosting, updateJobPosting } from "./service.js";

export async function createJobController(req, res, next) {
  try {
    const job = await createJobPosting(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
}

export async function listJobsController(req, res, next) {
  try {
    const jobs = await listJobsForContractor(req.auth.userId);
    return res.json({ success: true, data: jobs });
  } catch (error) {
    return next(error);
  }
}

export async function getJobByIdController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const job = await getJobDetails(id, req.auth.userId);
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
}

export async function updateJobController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const job = await updateJobPosting(id, req.auth.userId, req.body);
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
}

export async function deleteJobController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await removeJobPosting(id, req.auth.userId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
