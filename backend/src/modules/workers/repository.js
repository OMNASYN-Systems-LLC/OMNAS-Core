import { db } from "../../config/db.js";

export async function upsertWorkerProfile(userId, profile) {
  const query = `
    INSERT INTO worker_profiles (
      user_id, first_name, last_name, phone, home_zip,
      travel_radius_mi, trade_primary, years_experience, rating_avg, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, 0), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      home_zip = EXCLUDED.home_zip,
      travel_radius_mi = EXCLUDED.travel_radius_mi,
      trade_primary = EXCLUDED.trade_primary,
      years_experience = EXCLUDED.years_experience,
      rating_avg = EXCLUDED.rating_avg,
      updated_at = NOW()
    RETURNING *
  `;

  const values = [
    userId,
    profile.firstName,
    profile.lastName,
    profile.phone,
    profile.homeZip,
    profile.travelRadiusMi,
    profile.tradePrimary,
    profile.yearsExperience,
    profile.ratingAvg ?? 0
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
}

export async function getWorkerProfile(userId) {
  const { rows } = await db.query("SELECT * FROM worker_profiles WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

export async function addWorkerSkill(userId, skillId, attributes) {
  const query = `
    INSERT INTO worker_skills (worker_user_id, skill_id, proficiency, years, verified, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (worker_user_id, skill_id) DO UPDATE SET
      proficiency = EXCLUDED.proficiency,
      years = EXCLUDED.years,
      verified = EXCLUDED.verified,
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(query, [userId, skillId, attributes.proficiency, attributes.years, attributes.verified]);
  return rows[0];
}

export async function removeWorkerSkill(userId, skillId) {
  const { rowCount } = await db.query("DELETE FROM worker_skills WHERE worker_user_id = $1 AND skill_id = $2", [
    userId,
    skillId
  ]);

  return rowCount > 0;
}

export async function getWorkerSkills(userId) {
  const query = `
    SELECT ws.worker_user_id, ws.skill_id, ws.proficiency, ws.years, ws.verified,
           s.code, s.label, s.category
    FROM worker_skills ws
    JOIN skills s ON s.id = ws.skill_id
    WHERE ws.worker_user_id = $1
    ORDER BY s.label ASC
  `;

  const { rows } = await db.query(query, [userId]);
  return rows;
}

// --- Worker credentials ---

export async function listWorkerCredentials(userId) {
  const { rows } = await db.query(
    `SELECT id, credential_type, credential_id, issued_at, expires_at, verified,
            (expires_at IS NOT NULL AND expires_at < CURRENT_DATE)                        AS is_expired,
            (expires_at IS NOT NULL AND expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS expires_soon
     FROM worker_credentials
     WHERE worker_user_id = $1
     ORDER BY expires_at ASC NULLS LAST`,
    [userId]
  );
  return rows;
}

export async function insertCredential(userId, payload) {
  const { rows } = await db.query(
    `INSERT INTO worker_credentials
       (worker_user_id, credential_type, credential_id, issued_at, expires_at, verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      payload.credentialType,
      payload.credentialId   ?? null,
      payload.issuedAt       ?? null,
      payload.expiresAt      ?? null,
      payload.verified       ?? false
    ]
  );
  return rows[0];
}

export async function deleteCredential(id, userId) {
  const { rows } = await db.query(
    `DELETE FROM worker_credentials
     WHERE id = $1 AND worker_user_id = $2
     RETURNING *`,
    [id, userId]
  );
  return rows[0] ?? null;
}
