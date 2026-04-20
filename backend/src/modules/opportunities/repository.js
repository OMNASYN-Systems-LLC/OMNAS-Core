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
