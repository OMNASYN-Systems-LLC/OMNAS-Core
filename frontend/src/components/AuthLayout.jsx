import { Link, Outlet, useLocation } from "react-router-dom";

export function AuthLayout() {
  const location = useLocation();
  
  // 🔥 RESPONSIVE NAV SECTIONS
  const navItems = [
    // Auth
    { to: "/login", label: "🔐 Login", roles: ["all"] },
    { to: "/register", label: "📝 Register", roles: ["all"] },
    
    // Worker Flow
    { to: "/worker-profile", label: "👷 Worker Profile", roles: ["worker"] },
    { to: "/worker-dashboard", label: "📱 Worker Dashboard", roles: ["worker"] },
    
    // Contractor Flow  
    { to: "/contractor-profile", label: "🏢 Contractor Profile", roles: ["contractor"] },
    { to: "/contractor-dashboard", label: "💼 Contractor Dashboard", roles: ["contractor"] },
    
    // 🔥 CONSTRUCTION ANALYTICS (merged both branches!)
    { to: "/dashboard/pivot", label: "📊 Daily Pivot", roles: ["contractor", "superintendent"] },
    
    // Business Development
    { to: "/opportunities", label: "🎯 Opportunities", roles: ["contractor"] },
    
    // Quick Actions
    { to: "/job-matches/1", label: "👥 Matches", roles: ["contractor"] },
    { to: "/jobs/1", label: "📋 Jobs", roles: ["contractor"] }
  ];

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

        {/* 🔥 RESPONSIVE NAV */}
        <nav style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {navItems.map(({ to, label, roles }) => (
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