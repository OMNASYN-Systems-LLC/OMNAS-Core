import { Link, Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="app-shell">
      <section className="auth-card">
        <nav>
          <Link to="/login">Login</Link> | <Link to="/register">Register</Link> | <Link to="/worker-profile">Worker Profile</Link> |{" "}
          <Link to="/worker-dashboard">Worker Dashboard</Link> | <Link to="/contractor-profile">Contractor Profile</Link> |{" "}
          <Link to="/contractor-dashboard">Contractor Dashboard</Link> | <Link to="/opportunities">Opportunities</Link>
        </nav>
        <Outlet />
      </section>
    </div>
  );
}
