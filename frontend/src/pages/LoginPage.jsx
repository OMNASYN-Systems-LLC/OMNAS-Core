import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context.jsx";
import { login } from "../services/api.js";

function defaultPathForRole(role) {
  return role === "worker" ? "/worker-dashboard" : "/contractor-dashboard";
}

export function LoginPage() {
  const { isAuthenticated, session, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "", role: "worker" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await login({ email: form.email, password: form.password });
      const sessionData = {
        userId: response.data.id,
        email: response.data.email,
        token: response.data.token,
        role: form.role,
        companyId: null
      };
      setSession(sessionData);
      setMessage("Login successful.");

      const redirectTarget = location.state?.from?.pathname || defaultPathForRole(form.role);
      navigate(redirectTarget, { replace: true });
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={defaultPathForRole(session.role)} replace />;
  }

  return (
    <>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
          <option value="worker">Worker</option>
          <option value="contractor">Contractor</option>
          <option value="client">Client</option>
        </select>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          required
        />
        <button type="submit">Login</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </>
  );
}
