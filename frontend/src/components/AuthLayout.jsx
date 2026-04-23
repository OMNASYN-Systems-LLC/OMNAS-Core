import { Link, Outlet, useLocation } from "react-router-dom";
import { getStoredAuth, clearAuth } from "../hooks/useAuth.js";

// Nav items declared with the roles that can see them.
// "all" means visible even when not logged in (auth pages).
const NAV_ITEMS = [
  { to: "/login",               label: "Login",            roles: ["all"] },
  { to: "/register",            label: "Register",         roles: ["all"] },

  // Worker
  { to: "/worker-profile",      label: "My Profile",       roles: ["worker"] },
  { to: "/worker-dashboard",    label: "My Jobs",          roles: ["worker"] },

  // Contractor
  { to: "/contractor-profile",  label: "Company Profile",  roles: ["contractor"] },
  { to: "/contractor-dashboard",label: "Dashboard",        roles: ["contractor"] },
  { to: "/opportunities",       label: "Opportunities",    roles: ["contractor"] },

  // Operations triage — contractor + superintendent + client (read-only)
  { to: "/dashboard/triage",    label: "Operations Triage", roles: ["contractor", "superintendent", "client"] },

  // Escalation queue (superintendent override layer)
  { to: "/dashboard/pivot",     label: "Escalation Queue", roles: ["contractor", "superintendent"] },

  // Job intelligence
  { to: "/jobs/1",              label: "Jobs",             roles: ["contractor", "superintendent", "client"] }
];

export function AuthLayout() {
  const location  = useLocation();
  const auth      = getStoredAuth();
  const role      = auth?.role ?? null;

  const visibleItems = NAV_ITEMS.filter(({ roles }) =>
    roles.includes("all") || (role && roles.includes(role))
  );

  const getNavStyle = (to) => ({
    padding: "0.75rem 1.25rem",
    margin: "0 0.25rem",
    background: location.pathname === to ? "#1976d2" : "rgba(25, 118, 210, 0.1)",
    color: location.pathname === to ? "white" : "#1976d2",
    textDecoration: "none",
    borderRadius: "25px",
    border: `1px solid ${location.pathname === to ? "#1976d2" : "rgba(25, 118, 210, 0.2)"}`,
    fontWeight: "500",
    transition: "all 0.2s ease",
    fontSize: "0.95rem"
  });

  return (
    <div className="app-shell" style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      padding: "1rem",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* 🔥 PROFESSIONAL HEADER */}
      <header style={{
        background: "white",
        padding: "1.5rem 2rem",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        marginBottom: "2rem",
        border: "1px solid #e0e6ed"
      }}>
        {/* Logo */}
        <div style={{ 
          fontSize: "1.8rem", 
          fontWeight: "bold", 
          color: "#1976d2",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center"
        }}>
          🏗️ <span style={{ marginLeft: "0.5rem" }}>OMNAS Construction Platform</span>
        </div>

          <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", justifyContent: "center" }}>
          {visibleItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={getNavStyle(to)}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(25,118,210,0.3)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = location.pathname === to
                  ? "0 4px 12px rgba(25,118,210,0.4)"
                  : "none";
              }}
            >
              {label}
            </Link>
          ))}
          {auth && (
            <button
              type="button"
              onClick={() => { clearAuth(); window.location.href = "/login"; }}
              style={{ ...getNavStyle("/___logout___"), background: "rgba(239,68,68,0.1)", color: "#dc2626", borderColor: "rgba(239,68,68,0.3)" }}
            >
              Sign Out ({role})
            </button>
          )}
        </nav>
      </header>

      {/* 🔥 MAIN CONTENT */}
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

      {/* 🔥 FOOTER */}
      <footer style={{
        textAlign: "center",
        padding: "2rem",
        color: "#666",
        fontSize: "0.9rem"
      }}>
        <p>OMNAS Construction Platform © 2024 | Serving 1.5M+ construction professionals</p>
      </footer>
    </div>
  );
}