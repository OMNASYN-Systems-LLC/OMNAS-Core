import {
  enrichNormalizedOpportunities,
  getReadyOpportunities,
  importOpportunityAsJob,
  ingestSamGovOpportunities,
  normalizeFetchedOpportunities
} from "./service.js";

export async function fetchOpportunitiesController(req, res, next) {
  try {
    const maxPages = Number.parseInt(req.body?.maxPages ?? 1, 10);
    const limit = Number.parseInt(req.body?.limit ?? 100, 10);

    const result = await ingestSamGovOpportunities({
      maxPages: Number.isNaN(maxPages) ? 1 : maxPages,
      limit: Number.isNaN(limit) ? 100 : limit
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function normalizeOpportunitiesController(_req, res, next) {
  try {
    const result = await normalizeFetchedOpportunities();
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function enrichOpportunitiesController(_req, res, next) {
  try {
    const result = await enrichNormalizedOpportunities();
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

export async function listReadyOpportunitiesController(_req, res, next) {
  try {
    const opportunities = await getReadyOpportunities();
    return res.json({ success: true, data: opportunities });
  } catch (error) {
    return next(error);
  }
}

export async function importOpportunityController(req, res, next) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const result = await importOpportunityAsJob(id, req.auth.userId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}
