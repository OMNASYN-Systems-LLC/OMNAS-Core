import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearSession, getAuth } from "../hooks/useAuth.js";

const NAV_ITEMS = [
  { to: "/login",                label: "Login",               roles: null },
  { to: "/register",             label: "Register",            roles: null },
  { to: "/worker-profile",       label: "Worker Profile",      roles: ["worker"] },
  { to: "/worker-dashboard",     label: "Worker Dashboard",    roles: ["worker"] },
  { to: "/contractor-profile",   label: "Contractor Profile",  roles: ["contractor"] },
  { to: "/contractor-dashboard", label: "Contractor Dashboard",roles: ["contractor"] },
  { to: "/dashboard/pivot",      label: "Triage Dashboard",    roles: ["contractor", "superintendent", "client"] },
  { to: "/opportunities",        label: "Opportunities",       roles: ["contractor"] },
];

export function AuthLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getAuth();
  const userRole = auth?.role ?? null;

  const visibleItems = NAV_ITEMS.filter(({ roles }) =>
    roles === null || (userRole !== null && roles.includes(userRole))
  );

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  const activeStyle = { background: "#1976d2", color: "white", border: "1px solid #1976d2" };
  const inactiveStyle = { background: "rgba(25,118,210,0.1)", color: "#1976d2", border: "1px solid rgba(25,118,210,0.2)" };

  const linkStyle = (to) => ({
    padding: "0.75rem 1.25rem",
    margin: "0 0.25rem",
    textDecoration: "none",
    borderRadius: "25px",
    fontWeight: "500",
    fontSize: "0.95rem",
    ...(location.pathname === to ? activeStyle : inactiveStyle)
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      padding: "1rem",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <header style={{
        background: "white",
        padding: "1.5rem 2rem",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        marginBottom: "2rem",
        border: "1px solid #e0e6ed"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#1976d2" }}>
            OMNAS Construction Platform
          </div>
          {auth && (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#555" }}>
                {auth.name} &middot; <strong>{auth.role}</strong>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: "0.5rem 1.25rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {visibleItems.map(({ to, label }) => (
            <Link key={to} to={to} style={linkStyle(to)}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main style={{
        background: "white",
        padding: "2.5rem",
        borderRadius: "16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.1)",
        maxWidth: "1400px",
        margin: "0 auto",
        minHeight: "60vh"
      }}>
        <Outlet />
      </main>

      <footer style={{ textAlign: "center", padding: "2rem", color: "#666", fontSize: "0.9rem" }}>
        <p>OMNAS Construction Platform</p>
      </footer>
    </div>
  );
}
