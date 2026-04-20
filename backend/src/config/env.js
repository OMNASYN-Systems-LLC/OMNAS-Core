import dotenv from "dotenv";

dotenv.config();

const requiredVariables = ["PORT", "DATABASE_URL", "FRONTEND_URL"];

for (const variableName of requiredVariables) {
  if (!process.env[variableName]) {
    throw new Error(`Missing required environment variable: ${variableName}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number.parseInt(process.env.PORT, 10),
  frontendUrl: process.env.FRONTEND_URL,
  databaseUrl: process.env.DATABASE_URL,
  samGovApiKey: process.env.SAM_GOV_API_KEY ?? null
};
