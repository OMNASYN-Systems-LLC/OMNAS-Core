import { app } from "./app.js";
import { verifyDatabaseConnection } from "./config/db.js";
import { env } from "./config/env.js";

async function bootstrap() {
  try {
    await verifyDatabaseConnection();
    app.listen(env.port, () => {
      console.log(`OMNAS Assembler API listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

bootstrap();
