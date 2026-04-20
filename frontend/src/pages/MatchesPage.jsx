import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createAssignment, getJobMatches } from "../services/api.js";

export function MatchesPage() {
  const { jobId } = useParams();
  const auth = { userId: "00000000-0000-0000-0000-000000000002", role: "contractor" };
  const [matches, setMatches] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchMatches() {
      try {
        const response = await getJobMatches(jobId, auth);
        setMatches(response.data);
      } catch (error) {
        setMessage(error.message);
      }
    }

    fetchMatches();
  }, [jobId]);

  async function handleAssign(workerUserId) {
    try {
      await createAssignment({ jobId: Number(jobId), workerUserId }, auth);
      setMessage("Assignment offer sent.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <h1>Job Matches: #{jobId}</h1>
      <p>
        <Link to="/contractor-dashboard">Back to Contractor Dashboard</Link>
      </p>

      <ul>
        {matches.map((match) => (
          <li key={match.worker_user_id}>
            <strong>{match.worker_name}</strong> — Score: {match.total_score}
            <br />
            Skills: {match.skills.map((skill) => `${skill.label} (${skill.proficiency}/5)`).join(", ") || "No skills"}
            <br />
            Breakdown: skill {match.score_breakdown.skill_score}, availability {match.score_breakdown.availability_score}, location {match.score_breakdown.location_score}, total {match.score_breakdown.total_score}
            <br />
            <button type="button" onClick={() => handleAssign(match.worker_user_id)}>
              Assign Worker
            </button>
          </li>
        ))}
      </ul>

      {message ? <p className="message">{message}</p> : null}
    </>
  );
}
