import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../services/api.js";
import { saveRegisteredUser } from "../hooks/useAuth.js";

const ROLES = [
  { value: "worker",         label: "Worker (field)" },
  { value: "contractor",     label: "Contractor / GC" },
  { value: "superintendent", label: "Superintendent / PM" },
  { value: "client",         label: "Client / Owner" }
];

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.role) {
      setMessage("Please select a role.");
      return;
    }

    try {
      // Generate a stable UUID for this user on the client side.
      const userId = crypto.randomUUID();
      // Backend call is non-blocking in pilot mode; failure is non-fatal.
      try { await register({ name: form.name, email: form.email, password: form.password }); } catch { /* backend offline — proceed with localStorage */ }
      saveRegisteredUser(form.email, { id: userId, role: form.role, name: form.name });
      setMessage("Account created. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
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
        <select
          value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          required
        >
          <option value="">Select your role</option>
          {ROLES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit">Create account</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </>
  );
}
