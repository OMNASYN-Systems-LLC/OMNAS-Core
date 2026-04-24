import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/api.js";
import { getRegisteredUsers, setSession } from "../hooks/useAuth.js";

const ROLE_REDIRECTS = {
  worker:         "/worker-dashboard",
  contractor:     "/contractor-dashboard",
  superintendent: "/dashboard/pivot",
  client:         "/dashboard/pivot"
};

export function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      // Backend call kept for health-check; it doesn't persist users in pilot mode.
      await login(form);

      const users = getRegisteredUsers();
      const user = users[form.email];
      if (!user) {
        setMessage("No account found for this email. Please register first.");
        return;
      }

      setSession({ userId: user.id, role: user.role, name: user.name, email: form.email });
      navigate(ROLE_REDIRECTS[user.role] ?? "/");
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
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
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
