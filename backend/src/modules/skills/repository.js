import { db } from "../../config/db.js";

export async function listSkills() {
  const { rows } = await db.query("SELECT id, code, label, category FROM skills ORDER BY category ASC, label ASC");
  return rows;
}
