import { db } from "../../config/db.js";

export async function upsertOpportunity(opportunity) {
  const query = `
    INSERT INTO opportunities (
      source_notice_id, title, description, agency, naics_code,
      posted_date, deadline, raw_json, status, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'fetched',NOW())
    ON CONFLICT (source_notice_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      agency = EXCLUDED.agency,
      naics_code = EXCLUDED.naics_code,
      posted_date = EXCLUDED.posted_date,
      deadline = EXCLUDED.deadline,
      raw_json = EXCLUDED.raw_json,
      status = 'fetched',
      updated_at = NOW()
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    opportunity.sourceNoticeId,
    opportunity.title,
    opportunity.description,
    opportunity.agency,
    opportunity.naicsCode,
    opportunity.postedDate,
    opportunity.deadline,
    JSON.stringify(opportunity.rawJson)
  ]);

  return rows[0];
}

export async function listFetchedOpportunities() {
  const { rows } = await db.query("SELECT * FROM opportunities WHERE status = 'fetched' ORDER BY created_at ASC");
  return rows;
}

export async function listNormalizedOpportunities() {
  const { rows } = await db.query("SELECT * FROM opportunities WHERE status = 'normalized' ORDER BY updated_at ASC");
  return rows;
}

export async function updateOpportunityNormalized(id, normalized) {
  const query = `
    UPDATE opportunities SET
      title = $2,
      department = $3,
      sub_tier = $4,
      office = $5,
      agency = $6,
      naics_code = $7,
      solicitation_number = $8,
      notice_type = $9,
      posted_date = $10,
      response_deadline = $11,
      description_url = $12,
      pop_city = $13,
      pop_state = $14,
      pop_zip = $15,
      set_aside_code = $16,
      classification_code = $17,
      ui_link = $18,
      status = 'normalized',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    id,
    normalized.title,
    normalized.department,
    normalized.subTier,
    normalized.office,
    normalized.agency,
    normalized.naicsCode,
    normalized.solicitationNumber,
    normalized.noticeType,
    normalized.postedDate,
    normalized.responseDeadline,
    normalized.descriptionUrl,
    normalized.popCity,
    normalized.popState,
    normalized.popZip,
    normalized.setAsideCode,
    normalized.classificationCode,
    normalized.uiLink
  ]);

  return rows[0] ?? null;
}

export async function updateOpportunityEnriched(id, enriched) {
  const query = `
    UPDATE opportunities SET
      psc_code = $2,
      attachments = $3::jsonb,
      wage_determination = $4,
      status = 'ready',
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(query, [
    id,
    enriched.pscCode,
    JSON.stringify(enriched.attachments),
    enriched.wageDetermination
  ]);

  return rows[0] ?? null;
}
