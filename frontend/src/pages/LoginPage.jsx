import { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../services/api.js";

export function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await login(form);
      setMessage(`Welcome back! Session token: ${response.data.token}`);
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
        <button type="submit">Login</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
      <p>
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </>
  );
}
