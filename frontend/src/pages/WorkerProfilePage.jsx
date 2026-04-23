import { useEffect, useMemo, useState } from "react";
import {
  addWorkerSkill,
  getWorkerProfile,
  listSkills,
  removeWorkerSkill,
  upsertWorkerProfile,
  listWorkerCredentials,
  addWorkerCredential,
  deleteWorkerCredential
} from "../services/api.js";
import { getStoredAuth } from "../hooks/useAuth.js";

const WORKER_FALLBACK = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };

export function WorkerProfilePage() {
  const auth = getStoredAuth() ?? WORKER_FALLBACK;
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    homeZip: "",
    travelRadiusMi: 0,
    tradePrimary: "",
    yearsExperience: 0,
    ratingAvg: 0
  });
  const [catalog, setCatalog] = useState([]);
  const [workerSkills, setWorkerSkills] = useState([]);
  const [skillForm, setSkillForm] = useState({ skillId: "", proficiency: 3, years: 0, verified: false });
  const [message, setMessage] = useState("");

  // Credentials state
  const [credentials, setCredentials] = useState([]);
  const [credForm, setCredForm] = useState({ credentialType: "", credentialId: "", issuedAt: "", expiresAt: "", verified: false });

  const selectedSkill = useMemo(() => catalog.find((item) => String(item.id) === skillForm.skillId), [catalog, skillForm.skillId]);

  async function hydrate() {
    try {
      const [skillsResponse, profileResponse, credResponse] = await Promise.all([
        listSkills(auth),
        getWorkerProfile(auth),
        listWorkerCredentials(auth)
      ]);
      setCatalog(skillsResponse.data);
      setWorkerSkills(profileResponse.data.skills || []);
      setCredentials(credResponse.data ?? []);
      setProfileForm((prev) => ({
        ...prev,
        firstName: profileResponse.data.first_name || "",
        lastName: profileResponse.data.last_name || "",
        phone: profileResponse.data.phone || "",
        homeZip: profileResponse.data.home_zip || "",
        travelRadiusMi: profileResponse.data.travel_radius_mi || 0,
        tradePrimary: profileResponse.data.trade_primary || "",
        yearsExperience: profileResponse.data.years_experience || 0,
        ratingAvg: Number(profileResponse.data.rating_avg || 0)
      }));
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(event) {
    event.preventDefault();

    try {
      await upsertWorkerProfile(
        {
          ...profileForm,
          travelRadiusMi: Number(profileForm.travelRadiusMi),
          yearsExperience: Number(profileForm.yearsExperience),
          ratingAvg: Number(profileForm.ratingAvg)
        },
        auth
      );
      setMessage("Worker profile saved.");
      await hydrate();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addSkill(event) {
    event.preventDefault();

    try {
      await addWorkerSkill(
        {
          skillId: Number(skillForm.skillId),
          proficiency: Number(skillForm.proficiency),
          years: Number(skillForm.years),
          verified: Boolean(skillForm.verified)
        },
        auth
      );
      setMessage("Skill attached to worker profile.");
      await hydrate();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeSkill(skillId) {
    try {
      await removeWorkerSkill(skillId, auth);
      setMessage("Skill removed.");
      await hydrate();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function addCredential(event) {
    event.preventDefault();
    try {
      await addWorkerCredential({
        credentialType: credForm.credentialType,
        credentialId:   credForm.credentialId   || null,
        issuedAt:       credForm.issuedAt        || null,
        expiresAt:      credForm.expiresAt       || null,
        verified:       credForm.verified
      }, auth);
      setMessage("Credential added.");
      setCredForm({ credentialType: "", credentialId: "", issuedAt: "", expiresAt: "", verified: false });
      await hydrate();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeCredential(id) {
    try {
      await deleteWorkerCredential(id, auth);
      setMessage("Credential removed.");
      await hydrate();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Worker Profile</h1>
      <p className="message">Role-protected route for workers only.</p>

      <form onSubmit={saveProfile}>
        <input placeholder="First name" value={profileForm.firstName} onChange={(e) => setProfileForm((p) => ({ ...p, firstName: e.target.value }))} required />
        <input placeholder="Last name" value={profileForm.lastName} onChange={(e) => setProfileForm((p) => ({ ...p, lastName: e.target.value }))} required />
        <input placeholder="Phone" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
        <input placeholder="Home ZIP" value={profileForm.homeZip} onChange={(e) => setProfileForm((p) => ({ ...p, homeZip: e.target.value }))} />
        <input type="number" min="0" placeholder="Travel radius (mi)" value={profileForm.travelRadiusMi} onChange={(e) => setProfileForm((p) => ({ ...p, travelRadiusMi: e.target.value }))} />
        <input placeholder="Primary trade" value={profileForm.tradePrimary} onChange={(e) => setProfileForm((p) => ({ ...p, tradePrimary: e.target.value }))} required />
        <input type="number" min="0" placeholder="Years experience" value={profileForm.yearsExperience} onChange={(e) => setProfileForm((p) => ({ ...p, yearsExperience: e.target.value }))} required />
        <input type="number" min="0" max="5" step="0.1" placeholder="Rating average" value={profileForm.ratingAvg} onChange={(e) => setProfileForm((p) => ({ ...p, ratingAvg: e.target.value }))} />
        <button type="submit">Save Worker Profile</button>
      </form>

      <hr />

      <h2>Add Skill</h2>
      <form onSubmit={addSkill}>
        <select value={skillForm.skillId} onChange={(e) => setSkillForm((s) => ({ ...s, skillId: e.target.value }))} required>
          <option value="">Select skill</option>
          {catalog.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.label} ({skill.category})
            </option>
          ))}
        </select>
        <input type="number" min="1" max="5" value={skillForm.proficiency} onChange={(e) => setSkillForm((s) => ({ ...s, proficiency: e.target.value }))} required />
        <input type="number" min="0" value={skillForm.years} onChange={(e) => setSkillForm((s) => ({ ...s, years: e.target.value }))} required />
        <label>
          <input type="checkbox" checked={skillForm.verified} onChange={(e) => setSkillForm((s) => ({ ...s, verified: e.target.checked }))} />
          Verified
        </label>
        <button type="submit">Add/Update Skill</button>
      </form>

      {selectedSkill ? <p className="message">Selected: {selectedSkill.label}</p> : null}

      <h2>Current Skills</h2>
      <ul>
        {workerSkills.map((skill) => (
          <li key={skill.skill_id}>
            {skill.label} - proficiency {skill.proficiency}/5 ({skill.years} years)
            <button type="button" onClick={() => removeSkill(skill.skill_id)} style={{ marginLeft: "0.5rem" }}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <hr />

      <h2>Credentials</h2>
      <p className="message" style={{ fontSize: "0.85rem", color: "#64748b" }}>
        Credentials with an expiry date are checked at check-in. Keep them current.
      </p>

      {/* Add credential form */}
      <form onSubmit={addCredential} style={{ display: "grid", gap: "0.5rem", maxWidth: "480px", marginBottom: "1.5rem" }}>
        <input
          required
          placeholder="Credential type (e.g. OSHA-10, First Aid)"
          value={credForm.credentialType}
          onChange={(e) => setCredForm((c) => ({ ...c, credentialType: e.target.value }))}
        />
        <input
          placeholder="Certificate / ID number (optional)"
          value={credForm.credentialId}
          onChange={(e) => setCredForm((c) => ({ ...c, credentialId: e.target.value }))}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b" }}>Issued</label>
            <input
              type="date"
              value={credForm.issuedAt}
              onChange={(e) => setCredForm((c) => ({ ...c, issuedAt: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#64748b" }}>Expires</label>
            <input
              type="date"
              value={credForm.expiresAt}
              onChange={(e) => setCredForm((c) => ({ ...c, expiresAt: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <label style={{ fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={credForm.verified}
            onChange={(e) => setCredForm((c) => ({ ...c, verified: e.target.checked }))}
            style={{ marginRight: "0.4rem" }}
          />
          Verified by superintendent / third party
        </label>
        <button type="submit">Add Credential</button>
      </form>

      {/* Credentials list */}
      {credentials.length === 0 ? (
        <p className="message">No credentials on file.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
          {credentials.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                border: `1px solid ${c.is_expired ? "#fca5a5" : "#e2e8f0"}`,
                background: c.is_expired ? "#fff1f2" : c.expires_soon ? "#fefce8" : "#f8fafc"
              }}
            >
              <div>
                <strong>{c.credential_type}</strong>
                {c.credential_id && <span style={{ marginLeft: "0.5rem", color: "#64748b", fontSize: "0.85rem" }}>#{c.credential_id}</span>}
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  {c.expires_at ? (
                    <>
                      Expires {new Date(c.expires_at).toLocaleDateString()}
                      {c.is_expired    && <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: "0.4rem" }}>EXPIRED</span>}
                      {c.expires_soon  && !c.is_expired && <span style={{ color: "#d97706", fontWeight: 700, marginLeft: "0.4rem" }}>EXPIRING SOON</span>}
                    </>
                  ) : "No expiry"}
                  {c.verified && <span style={{ marginLeft: "0.5rem", color: "#15803d" }}>✓ Verified</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeCredential(c.id)}
                style={{ padding: "0.35rem 0.75rem", borderRadius: "6px", border: "1px solid #fca5a5", background: "white", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
