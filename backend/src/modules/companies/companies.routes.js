import { Router } from "express";
import { requireAuth } from "../../middleware/authContext.js";
import {
  claimCompanyController,
  getCompanyController,
  inviteCompanyController,
  listCompaniesController
} from "./companies.controller.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);
companiesRouter.post("/invite", inviteCompanyController);
companiesRouter.post("/claim", claimCompanyController);
companiesRouter.get("/:id", getCompanyController);
companiesRouter.get("/", listCompaniesController);
