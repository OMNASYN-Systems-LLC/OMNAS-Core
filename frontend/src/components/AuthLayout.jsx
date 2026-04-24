import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context.jsx";

function NavLink({ to, children }) {
  return <Link to={to}>{children}</Link>;
}

export function AuthLayout() {
  const { isAuthenticated, session, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <section className="auth-card">
        <nav>
          {!isAuthenticated ? (
            <>
              <NavLink to="/login">Login</NavLink> | <NavLink to="/register">Register</NavLink>
            </>
          ) : (
            <>
              {session.role === "worker" ? (
                <>
                  <NavLink to="/worker-profile">Worker Profile</NavLink> | <NavLink to="/worker-dashboard">Worker Dashboard</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/contractor-profile">Contractor Profile</NavLink> | <NavLink to="/contractor-dashboard">Contractor Dashboard</NavLink> |{" "}
                  <NavLink to="/dashboard/pivot">Daily Pivot</NavLink> | <NavLink to="/opportunities">Opportunities</NavLink>
                </>
              )}
              {" "}| <button type="button" className="link-button" onClick={handleLogout}>Logout</button>
              <span className="message" style={{ marginLeft: "0.75rem" }}>Session: {session.role} · {session.userId.slice(0, 8)}…</span>
            </>
          )}
        </nav>
        <Outlet />
      </section>
    </div>
  );
}
