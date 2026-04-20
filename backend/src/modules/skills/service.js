import { listSkills } from "./repository.js";

export async function getSkillsCatalog() {
  return listSkills();
}
