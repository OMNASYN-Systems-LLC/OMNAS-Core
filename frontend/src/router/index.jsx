import { Navigate, createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout.jsx";
import { ContractorDashboardPage } from "../pages/ContractorDashboardPage.jsx";
import { ContractorProfilePage } from "../pages/ContractorProfilePage.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { JobDetailPage } from "../pages/JobDetailPage.jsx";
import { MatchesPage } from "../pages/MatchesPage.jsx";
import { OpportunitiesPage } from "../pages/OpportunitiesPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";
import { WorkerDashboardPage } from "../pages/WorkerDashboardPage.jsx";
import { WorkerProfilePage } from "../pages/WorkerProfilePage.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />
      },
      {
        path: "login",
        element: <LoginPage />
      },
      {
        path: "register",
        element: <RegisterPage />
      },
      {
        path: "worker-profile",
        element: <WorkerProfilePage />
      },
      {
        path: "worker-dashboard",
        element: <WorkerDashboardPage />
      },
      {
        path: "contractor-profile",
        element: <ContractorProfilePage />
      },
      {
        path: "contractor-dashboard",
        element: <ContractorDashboardPage />
      },
      {
        path: "opportunities",
        element: <OpportunitiesPage />
      },
      {
        path: "job-matches/:jobId",
        element: <MatchesPage />
      },
      {
        path: "jobs/:jobId",
        element: <JobDetailPage />
      }
    ]
  }
]);
