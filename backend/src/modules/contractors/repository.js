import { db } from "../../config/db.js";

export async function upsertContractorProfile(userId, payload) {
  const query = `
    INSERT INTO contractor_profiles (user_id, company_name, license_number, bonding_limit, updated_at)
    VALUES ($1,$2,$3,$4, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      license_number = EXCLUDED.license_number,
      bonding_limit = EXCLUDED.bonding_limit,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(query, [userId, payload.companyName, payload.licenseNumber, payload.bondingLimit]);
  return rows[0];
}

export async function getContractorProfile(userId) {
  const { rows } = await db.query("SELECT * FROM contractor_profiles WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}
