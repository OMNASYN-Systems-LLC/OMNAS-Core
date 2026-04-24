import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context.jsx";

export function RequireAuth({ allowedRoles }) {
  const { isAuthenticated, session } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(session.role)) {
    const fallback = session.role === "worker" ? "/worker-dashboard" : "/contractor-dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
