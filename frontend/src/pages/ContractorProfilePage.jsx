import { useEffect, useState } from "react";
import { getContractorProfile, upsertContractorProfile } from "../services/api.js";

export function ContractorProfilePage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
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
