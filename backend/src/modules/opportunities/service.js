import { fetchOpportunities } from "../../clients/samGovClient.js";
import { upsertOpportunity } from "./repository.js";

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
