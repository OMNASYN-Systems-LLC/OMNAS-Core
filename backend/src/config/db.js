import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const db = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === "production" ? { rejectUnauthorized: false } : false
});

export async function verifyDatabaseConnection() {
  const client = await db.connect();

  try {
    await client.query("SELECT NOW() as now");
  } finally {
    client.release();
  }
}
