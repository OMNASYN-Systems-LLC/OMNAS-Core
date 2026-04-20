import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../services/api.js";

export function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await register(form);
      setMessage(`Account created for ${response.data.email}`);
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
