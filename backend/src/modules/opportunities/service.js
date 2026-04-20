import { fetchOpportunities } from "../../clients/samGovClient.js";
import {
  listFetchedOpportunities,
  listNormalizedOpportunities,
  updateOpportunityEnriched,
  updateOpportunityNormalized,
  upsertOpportunity
} from "./repository.js";

function toNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" && value.trim().toLowerCase() === "null") {
    return null;
  }

  return value;
}

function normalizeRecord(record) {
  return {
    sourceNoticeId: record.noticeId || record.solicitationNumber || record.id,
    title: record.title || record.opportunityTitle || null,
    description: record.description || record.fullParentPathName || null,
    agency: record.department || record.fullParentPathName || null,
    naicsCode: record.naicsCode || null,
    postedDate: record.postedDate || null,
    deadline: record.responseDeadLine || record.archiveDate || null,
    rawJson: record
  };
}

function extractItems(payload) {
  if (Array.isArray(payload?.opportunitiesData)) {
    return payload.opportunitiesData;
  }

  if (Array.isArray(payload?.opportunities)) {
    return payload.opportunities;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function buildAgency(parts) {
  return parts.filter(Boolean).join(" / ") || null;
}

function normalizeFromRaw(raw) {
  const safe = raw || {};
  const pop = safe.placeOfPerformance || {};
  const city = pop.city || {};
  const state = pop.state || {};

  return {
    title: toNull(safe.title),
    department: toNull(safe.department),
    subTier: toNull(safe.subTier),
    office: toNull(safe.office),
    agency: buildAgency([toNull(safe.department), toNull(safe.subTier), toNull(safe.office)]),
    naicsCode: toNull(safe.naicsCode),
    solicitationNumber: toNull(safe.solicitationNumber),
    noticeType: toNull(safe.baseType ?? safe.type),
    postedDate: toNull(safe.postedDate),
    responseDeadline: toNull(safe.responseDeadLine),
    descriptionUrl: toNull(safe.description),
    popCity: toNull(city.name),
    popState: toNull(state.code),
    popZip: toNull(pop.zip),
    setAsideCode: toNull(safe.typeOfSetAside),
    classificationCode: toNull(safe.classificationCode),
    uiLink: toNull(safe.uiLink)
  };
}

function enrichFromRaw(raw) {
  const safe = raw || {};
  const rawLinks = Array.isArray(safe.resourceLinks) ? safe.resourceLinks : [];

  const attachments = rawLinks
    .map((link) => {
      if (typeof link === "string") {
        return { url: toNull(link), filename: null, type: null };
      }

      if (link && typeof link === "object") {
        return {
          url: toNull(link.url ?? link.href ?? link.link),
          filename: toNull(link.filename ?? link.name ?? null),
          type: toNull(link.type ?? link.mimeType ?? null)
        };
      }

      return null;
    })
    .filter((item) => item && item.url);

  return {
    pscCode: toNull(safe.classificationCode),
    attachments,
    wageDetermination: toNull(safe.wageDeterminationNumber)
  };
}

export async function ingestSamGovOpportunities({ maxPages = 1, limit = 100 } = {}) {
  const saved = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetchOpportunities({ page, limit });
    const records = extractItems(response);

    for (const record of records) {
      const mapped = normalizeRecord(record);

      if (!mapped.sourceNoticeId) {
        continue;
      }

      const row = await upsertOpportunity(mapped);
      saved.push(row);
    }

    if (records.length === 0) {
      break;
    }
  }

  return {
    fetchedCount: saved.length,
    opportunities: saved
  };
}

export async function normalizeFetchedOpportunities() {
  const fetched = await listFetchedOpportunities();
  const normalized = [];
  const errors = [];

  for (const opportunity of fetched) {
    try {
      const mapped = normalizeFromRaw(opportunity.raw_json);
      const row = await updateOpportunityNormalized(opportunity.id, mapped);
      if (row) {
        normalized.push(row);
      }
    } catch (error) {
      console.error("Failed to normalize opportunity", opportunity.id, error);
      errors.push({ id: opportunity.id, message: error.message });
    }
  }

  return {
    processed: fetched.length,
    normalizedCount: normalized.length,
    errorCount: errors.length,
    errors
  };
}

export async function enrichNormalizedOpportunities() {
  const normalizedRows = await listNormalizedOpportunities();
  const enriched = [];
  const errors = [];

  for (const opportunity of normalizedRows) {
    try {
      const mapped = enrichFromRaw(opportunity.raw_json);
      const row = await updateOpportunityEnriched(opportunity.id, mapped);
      if (row) {
        enriched.push(row);
      }
    } catch (error) {
      console.error("Failed to enrich opportunity", opportunity.id, error);
      errors.push({ id: opportunity.id, message: error.message });
    }
  }

  return {
    processed: normalizedRows.length,
    enrichedCount: enriched.length,
    errorCount: errors.length,
    errors
  };
}
