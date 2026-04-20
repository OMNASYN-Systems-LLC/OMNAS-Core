import { useEffect, useMemo, useState } from "react";
import { addWorkerSkill, getWorkerProfile, listSkills, removeWorkerSkill, upsertWorkerProfile } from "../services/api.js";

export function WorkerProfilePage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000001", role: "worker" };
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

  const selectedSkill = useMemo(() => catalog.find((item) => String(item.id) === skillForm.skillId), [catalog, skillForm.skillId]);

  async function hydrate() {
    try {
      const [skillsResponse, profileResponse] = await Promise.all([listSkills(auth), getWorkerProfile(auth)]);
      setCatalog(skillsResponse.data);
      setWorkerSkills(profileResponse.data.skills || []);
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

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
