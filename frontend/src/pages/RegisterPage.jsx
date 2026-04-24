import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context.jsx";
import { register } from "../services/api.js";

function defaultPathForRole(role) {
  return role === "worker" ? "/worker-profile" : "/contractor-profile";
}

export function RegisterPage() {
  const { isAuthenticated, session, setSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "worker" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await register({ name: form.name, email: form.email, password: form.password });
      setSession({
        userId: response.data.id,
        email: response.data.email,
        role: form.role,
        token: null,
        companyId: null
      });
      setMessage(`Account created for ${response.data.email}`);
      navigate(defaultPathForRole(form.role), { replace: true });
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (isAuthenticated) {
    return <Navigate to={defaultPathForRole(session.role)} replace />;
  }

  return (
    <>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
          <option value="worker">Worker</option>
          <option value="contractor">Contractor</option>
          <option value="client">Client</option>
        </select>
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
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
        <button type="submit">Create account</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </>
  );
}
