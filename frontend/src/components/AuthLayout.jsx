import { Link, Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="app-shell">
      <section className="auth-card">
        <Outlet />
        <p>
          <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
        </p>
      </section>
    </div>
  );
}
