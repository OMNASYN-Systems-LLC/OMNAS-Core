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

export async function listReadyOpportunities() {
  const { rows } = await db.query("SELECT * FROM opportunities WHERE status = 'ready' ORDER BY updated_at DESC");
  return rows;
}

export async function getOpportunityById(id) {
  const { rows } = await db.query("SELECT * FROM opportunities WHERE id = $1", [id]);
  return rows[0] ?? null;
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

async function upsertSkill(client, { code, label, category }) {
  const query = `
    INSERT INTO skills (code, label, category)
    VALUES ($1, $2, $3)
    ON CONFLICT (code) DO UPDATE SET
      label = EXCLUDED.label,
      category = EXCLUDED.category
    RETURNING id
  `;

  const { rows } = await client.query(query, [code, label, category]);
  return rows[0].id;
}

export async function importOpportunityToJob(opportunity, contractorUserId, mappedSkills) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      "SELECT id FROM jobs WHERE organization_id = $1 AND source_notice_id = $2 LIMIT 1",
      [contractorUserId, opportunity.source_notice_id]
    );

    if (duplicateCheck.rowCount > 0) {
      const error = new Error("Opportunity already imported for this organization");
      error.statusCode = 409;
      throw error;
    }

    const startsAt = opportunity.posted_date ? new Date(opportunity.posted_date) : new Date();
    const endsAt = opportunity.response_deadline ? new Date(opportunity.response_deadline) : new Date(startsAt.getTime() + 30 * 86400000);

    const jobInsert = `
      INSERT INTO jobs (
        organization_id, posted_by, title, description, site_zip,
        starts_at, ends_at, pay_rate, status, source_system, source_notice_id, metadata, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10,$11::jsonb,NOW())
      RETURNING *
    `;

    const metadata = {
      wage_determination: opportunity.wage_determination
    };

    const { rows } = await client.query(jobInsert, [
      contractorUserId,
      contractorUserId,
      opportunity.title || `SAM.gov Opportunity ${opportunity.source_notice_id}`,
      opportunity.description || opportunity.description_url || "Imported from SAM.gov",
      opportunity.pop_zip,
      startsAt.toISOString(),
      endsAt.toISOString(),
      0,
      "SAM_GOV",
      opportunity.source_notice_id,
      JSON.stringify(metadata)
    ]);

    const job = rows[0];

    for (const skill of mappedSkills) {
      const skillId = await upsertSkill(client, skill);
      await client.query(
        `INSERT INTO job_required_skills (job_id, skill_id, min_proficiency, required)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (job_id, skill_id) DO UPDATE SET
           min_proficiency = EXCLUDED.min_proficiency,
           required = EXCLUDED.required`,
        [job.id, skillId, 3, true]
      );
    }

    await client.query("UPDATE opportunities SET status = 'imported', updated_at = NOW() WHERE id = $1", [opportunity.id]);

    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
