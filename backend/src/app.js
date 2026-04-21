import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";

// 🔥 CORE ROUTES
import { authRouter } from "./routes/authRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";
import { workerRouter } from "./modules/workers/routes.js";
import { contractorRouter } from "./modules/contractors/routes.js";
import { skillsRouter } from "./modules/skills/routes.js";
import { jobsRouter } from "./modules/jobs/routes.js";
import { matchingRouter } from "./modules/matching/routes.js";
import { assignmentsRouter } from "./modules/assignments/routes.js";
import { assignmentLogsRouter, logsRouter } from "./modules/logs/routes.js";
import { opportunitiesRouter } from "./modules/opportunities/routes.js";

// 🔥 ENTERPRISE CONSTRUCTION FEATURES (merged codex branch)
import { recommendationsRouter } from "./modules/recommendations/routes.js";
import { schedulingRouter } from "./modules/scheduling/routes.js";
import { escalationsRouter } from "./modules/escalations/routes.js";
import { financialRouter } from "./modules/financial/financial.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { actionsRouter } from "./modules/actions/actions.routes.js";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

// 🔥 PRODUCTION SECURITY + MONITORING
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", env.frontendUrl]
    }
  }
}));

app.use(cors({ 
  origin: env.frontendUrl,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-role"]
}));

app.use(express.json({ limit: "10mb" })); // Construction photos
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// 🔥 API ROUTES - CORE
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/workers", workerRouter);
app.use("/api/contractors", contractorRouter);
app.use("/api/skills", skillsRouter);

// 🔥 JOBS ECOSYSTEM (nested for construction workflows)
app.use("/api/jobs", jobsRouter);                    // Job CRUD
app.use("/api/jobs/matching", matchingRouter);       // AI matching
app.use("/api/jobs/recommendations", recommendationsRouter);  // OMNAS AI
app.use("/api/jobs/scheduling", schedulingRouter);   // Construction scheduling
app.use("/api/jobs/financial", financialRouter);     // Profit erosion
app.use("/api/jobs/analytics", analyticsRouter);     // Pivot dashboard data
app.use("/api/jobs", dashboardRouter);               // Aggregation dashboard

// 🔥 ASSIGNMENTS + LOGGING (construction field ops)
app.use("/api/assignments", assignmentsRouter);
app.use("/api/assignments", assignmentLogsRouter);   // Assignment-specific logs
app.use("/api/logs", logsRouter);                    // Voice + execution logs

// 🔥 OPPORTUNITIES + ESCALATIONS
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/escalations", escalationsRouter);      // Safety + issue escalation

// 🔥 ACTIONS / DIRECTIVES
app.use("/api/actions", actionsRouter);              // Draft directive system

// 🔥 ERROR HANDLING
app.use(notFoundHandler);
app.use(errorHandler);