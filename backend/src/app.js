import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { workerRouter } from "./modules/workers/routes.js";
import { contractorRouter } from "./modules/contractors/routes.js";
import { skillsRouter } from "./modules/skills/routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/workers", workerRouter);
app.use("/api/contractors", contractorRouter);
app.use("/api/skills", skillsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
