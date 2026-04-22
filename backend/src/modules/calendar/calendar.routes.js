import { Router } from "express";
import { requireAuth } from "../../middleware/authContext.js";
import {
  createCalendarEventController,
  listCalendarEventsController
} from "./calendar.controller.js";

export const calendarRouter = Router();

calendarRouter.use(requireAuth);
calendarRouter.get("/",  listCalendarEventsController);
calendarRouter.post("/", createCalendarEventController);
