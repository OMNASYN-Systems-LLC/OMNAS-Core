import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createAssignment, getJobMatches } from "../services/api.js";
import { getAuth } from "../hooks/useAuth.js";

export function MatchesPage() {
  const { jobId } = useParams();
  const auth = getAuth();
  if (!auth) return <p>Please <Link to="/login">log in</Link>.</p>;
  const [matches, setMatches] = useState([]);
  const [message, setMessage] = useState("");

  const topPerformerId = useMemo(() => (matches.length > 0 ? matches[0].worker_user_id : null), [matches]);

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
            <strong>{match.worker_name}</strong>
            {topPerformerId === match.worker_user_id ? <span> ⭐ Top Performer</span> : null}
            <br />
            Score: {match.total_score}
            <br />
            Skills: {match.skills.map((skill) => `${skill.label} (${skill.proficiency}/5)`).join(", ") || "No skills"}
            <br />
            Performance: completed {match.performance?.total_jobs_completed ?? 0}, hours {match.performance?.total_hours_logged ?? 0}, completion rate {match.performance?.completion_rate ?? 0}, avg hours/day {match.performance?.avg_hours_per_day ?? 0}
            <br />
            Breakdown: skill {match.score_breakdown.skill_score}, availability {match.score_breakdown.availability_score}, location {match.score_breakdown.location_score}, performance {match.score_breakdown.performance_score}, total {match.score_breakdown.total_score}
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
