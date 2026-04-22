import axios from "axios";
import { env } from "../../config/env.js";

const BASE_URL = "https://api.sam.gov/prod/opportunities/v2/search";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000
});

export async function fetchOpportunities({ page = 1, limit = 100, extraParams = {} } = {}) {
  if (!env.samGovApiKey) {
    const error = new Error("SAM_GOV_API_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }

  const response = await client.get("", {
    params: {
      api_key: env.samGovApiKey,
      page,
      limit,
      ...extraParams
    }
  });

  return response.data;
}
