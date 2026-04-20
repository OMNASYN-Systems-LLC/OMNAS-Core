import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { importOpportunityToJob, listReadyOpportunities } from "../services/api.js";

export function OpportunitiesPage() {
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [opportunities, setOpportunities] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function loadReady() {
    try {
      const response = await listReadyOpportunities(auth);
      setOpportunities(response.data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadReady();
  }, []);

  async function handleImport(id) {
    try {
      await importOpportunityToJob(id, auth);
      setMessage("Opportunity imported into jobs.");
      navigate("/contractor-dashboard");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Ready Opportunities</h1>
      <ul>
        {opportunities.map((opportunity) => (
          <li key={opportunity.id}>
            <strong>{opportunity.title || opportunity.source_notice_id}</strong> — PSC {opportunity.psc_code || "N/A"}
            <button type="button" onClick={() => handleImport(opportunity.id)} style={{ marginLeft: "0.5rem" }}>
              Import to Job
            </button>
          </li>
        ))}
      </ul>
      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
