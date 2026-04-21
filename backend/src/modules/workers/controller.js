import {
  addSkillToWorker,
  createOrUpdateWorkerProfile,
  getWorkerProfileWithSkills,
  removeSkillFromWorker
} from "./service.js";

export async function upsertWorkerProfileController(req, res, next) {
  try {
    const profile = await createOrUpdateWorkerProfile(req.auth.userId, req.body);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
}

export async function addWorkerSkillController(req, res, next) {
  try {
    const skill = await addSkillToWorker(req.auth.userId, req.body);
    return res.status(201).json({ success: true, data: skill });
  } catch (error) {
    return next(error);
  }
}

export async function removeWorkerSkillController(req, res, next) {
  try {
    const skillId = Number.parseInt(req.params.skillId, 10);
    await removeSkillFromWorker(req.auth.userId, skillId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function getWorkerProfileController(req, res, next) {
  try {
    const profile = await getWorkerProfileWithSkills(req.auth.userId);
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
}
