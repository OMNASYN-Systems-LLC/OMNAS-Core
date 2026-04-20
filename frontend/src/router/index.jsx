import { Navigate, createBrowserRouter } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout.jsx";
import { LoginPage } from "../pages/LoginPage.jsx";
import { RegisterPage } from "../pages/RegisterPage.jsx";

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
      }
    ]
  }
]);
