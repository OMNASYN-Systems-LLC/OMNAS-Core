import { useEffect, useMemo, useState } from "react";
import { createJob, deleteJob, listJobs, listSkills } from "../services/api.js";

export function ContractorDashboardPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState("");
  const [jobForm, setJobForm] = useState({
    organizationId: "00000000-0000-0000-0000-000000000010",
    title: "",
    description: "",
    siteZip: "",
    startsAt: "",
    endsAt: "",
    payRate: "0"
  });

  const selectedSkills = useMemo(
    () => skillsCatalog.filter((skill) => selectedSkillIds.includes(String(skill.id))),
    [skillsCatalog, selectedSkillIds]
  );

  async function refresh() {
    try {
      const [skillsResponse, jobsResponse] = await Promise.all([listSkills(auth), listJobs(auth)]);
      setSkillsCatalog(skillsResponse.data);
      setJobs(jobsResponse.data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggleSkill(skillId) {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  }

  async function handleCreateJob(event) {
    event.preventDefault();

    try {
      await createJob(
        {
          ...jobForm,
          payRate: Number(jobForm.payRate),
          startsAt: new Date(jobForm.startsAt).toISOString(),
          endsAt: new Date(jobForm.endsAt).toISOString(),
          requiredSkills: selectedSkillIds.map((skillId) => ({
            skillId: Number(skillId),
            minProficiency: 3,
            required: true
          }))
        },
        auth
      );

      setMessage("Job created successfully.");
      setSelectedSkillIds([]);
      setJobForm((prev) => ({ ...prev, title: "", description: "", siteZip: "", startsAt: "", endsAt: "", payRate: "0" }));
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteJob(jobId) {
    try {
      await deleteJob(jobId, auth);
      setMessage("Job deleted.");
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Contractor Dashboard</h1>

      <h2>Create Job</h2>
      <form onSubmit={handleCreateJob}>
        <input placeholder="Organization UUID" value={jobForm.organizationId} onChange={(e) => setJobForm((p) => ({ ...p, organizationId: e.target.value }))} required />
        <input placeholder="Title" value={jobForm.title} onChange={(e) => setJobForm((p) => ({ ...p, title: e.target.value }))} required />
        <textarea placeholder="Description" value={jobForm.description} onChange={(e) => setJobForm((p) => ({ ...p, description: e.target.value }))} required rows={4} />
        <input placeholder="Site ZIP" value={jobForm.siteZip} onChange={(e) => setJobForm((p) => ({ ...p, siteZip: e.target.value }))} />
        <input type="datetime-local" value={jobForm.startsAt} onChange={(e) => setJobForm((p) => ({ ...p, startsAt: e.target.value }))} required />
        <input type="datetime-local" value={jobForm.endsAt} onChange={(e) => setJobForm((p) => ({ ...p, endsAt: e.target.value }))} required />
        <input type="number" min="0" step="0.01" placeholder="Pay rate" value={jobForm.payRate} onChange={(e) => setJobForm((p) => ({ ...p, payRate: e.target.value }))} required />

        <fieldset>
          <legend>Required Skills (select at least one)</legend>
          {skillsCatalog.map((skill) => (
            <label key={skill.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={selectedSkillIds.includes(String(skill.id))}
                onChange={() => toggleSkill(String(skill.id))}
              />
              {skill.label} ({skill.category})
            </label>
          ))}
        </fieldset>

        <button type="submit">Create Job</button>
      </form>

      <p className="message">
        Selected skills: {selectedSkills.length > 0 ? selectedSkills.map((item) => item.label).join(", ") : "none"}
      </p>

      <h2>Posted Jobs</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <strong>{job.title}</strong> — {job.status} — starts {new Date(job.starts_at).toLocaleString()} — skills: {job.skill_count}
            <button type="button" onClick={() => handleDeleteJob(job.id)} style={{ marginLeft: "0.5rem" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
