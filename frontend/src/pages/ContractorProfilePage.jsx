import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getContractorProfile, upsertContractorProfile } from "../services/api.js";
import { getAuth } from "../hooks/useAuth.js";

export function ContractorProfilePage() {
  const auth = getAuth();
  if (!auth) return <p>Please <Link to="/login">log in</Link> to view your profile.</p>;
  const [form, setForm] = useState({ companyName: "", licenseNumber: "", bondingLimit: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await getContractorProfile(auth);
        setForm({
          companyName: response.data.company_name || "",
          licenseNumber: response.data.license_number || "",
          bondingLimit: response.data.bonding_limit || 0
        });
      } catch (error) {
        setMessage(error.message);
      }
    }

    loadProfile();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await upsertContractorProfile(
        {
          ...form,
          bondingLimit: Number(form.bondingLimit)
        },
        auth
      );

      setMessage("Contractor profile saved.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Contractor Profile</h1>
      <p className="message">Role-protected route for contractors only.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Company name"
          value={form.companyName}
          onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="License number"
          value={form.licenseNumber}
          onChange={(event) => setForm((prev) => ({ ...prev, licenseNumber: event.target.value }))}
          required
        />
        <input
          type="number"
          min="0"
          placeholder="Bonding limit"
          value={form.bondingLimit}
          onChange={(event) => setForm((prev) => ({ ...prev, bondingLimit: event.target.value }))}
        />
        <button type="submit">Save Contractor Profile</button>
      </form>
      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
