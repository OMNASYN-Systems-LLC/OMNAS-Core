import { Navigate, createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout.jsx";
import { ContractorDashboardPage } from "../pages/ContractorDashboardPage.jsx";
import { ContractorProfilePage } from "../pages/ContractorProfilePage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { JobDetailPage } from "../pages/JobDetailPage.jsx";
import { MatchesPage } from "../pages/MatchesPage.jsx";
import { OpportunitiesPage } from "../pages/OpportunitiesPage.jsx";
import { PivotDashboardPage } from "../pages/PivotDashboardPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { TriageDashboardPage } from "../pages/TriageDashboardPage.jsx";
import { WorkerDashboardPage } from "../pages/WorkerDashboardPage.jsx";
import { WorkerProfilePage } from "../pages/WorkerProfilePage.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      // 🔥 DEFAULT REDIRECT
      {
        index: true,
        element: <Navigate to="/login" replace />
      },

      // 🔥 AUTHENTICATION
      {
        path: "login",
        element: <LoginPage />
      },
      {
        path: "register",
        element: <RegisterPage />
      },

      // 🔥 WORKER WORKFLOW
      {
        path: "worker-profile",
        element: <WorkerProfilePage />
      },
      {
        path: "worker-dashboard",
        element: <WorkerDashboardPage />
      },

      // 🔥 CONTRACTOR WORKFLOW
      {
        path: "contractor-profile",
        element: <ContractorProfilePage />
      },
      {
        path: "contractor-dashboard",
        element: <ContractorDashboardPage />
      },

      // 🔥 BUSINESS DEVELOPMENT
      {
        path: "opportunities",
        element: <OpportunitiesPage />
      },

      // 🔥 JOB MANAGEMENT
      {
        path: "job-matches/:jobId",
        element: <MatchesPage />
      },
      {
        path: "jobs/:jobId",
        element: <JobDetailPage />
      },

      // Pilot operations triage (locked jobs, compliance alerts, ghost events)
      {
        path: "dashboard/triage",
        element: <TriageDashboardPage />
      },

      // Escalation decision queue (superintendent amber/red/green layer)
      {
        path: "dashboard/pivot",
        element: <PivotDashboardPage />
      }
    ]
  }
]);