import { app } from "./app.js";
import { verifyDatabaseConnection } from "./config/db.js";
import { env } from "./config/env.js";
import { startDispatchWorker } from "./modules/assembler/dispatch.worker.js";

async function bootstrap() {
  try {
    await verifyDatabaseConnection();
    app.listen(env.port, () => {
      console.log(`OMNAS Assembler API listening on port ${env.port}`);
      startDispatchWorker();
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

bootstrap();
