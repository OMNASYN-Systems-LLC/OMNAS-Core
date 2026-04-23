import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/api.js";
import { saveAuth } from "../hooks/useAuth.js";

const ROLE_HOME = {
  worker:         "/worker-dashboard",
  contractor:     "/contractor-dashboard",
  superintendent: "/dashboard/triage",
  client:         "/dashboard/triage"
};

export function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "", role: "worker" });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await login(form);
      const { userId, role } = response.data ?? {};
      const resolvedRole = role ?? form.role;
      const resolvedId   = userId ?? "00000000-0000-0000-0000-000000000001";
      saveAuth({ userId: resolvedId, role: resolvedRole });
      setMessage(`Logged in as ${resolvedRole}`);
      navigate(ROLE_HOME[resolvedRole] ?? "/worker-dashboard");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
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
        <select
          value={form.role}
          onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
          style={{ display: "block", marginTop: "0.5rem", padding: "0.5rem", width: "100%" }}
        >
          <option value="worker">Worker</option>
          <option value="contractor">Contractor</option>
          <option value="superintendent">Superintendent / PM</option>
          <option value="client">Client / Owner</option>
        </select>
        <button type="submit">Login</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </>
  );
}
