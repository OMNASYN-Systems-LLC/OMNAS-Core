import { getSkillsCatalog } from "./service.js";

export async function listSkillsController(_req, res, next) {
  try {
    const skills = await getSkillsCatalog();
    return res.json({ success: true, data: skills });
  } catch (error) {
    return next(error);
  }
}
