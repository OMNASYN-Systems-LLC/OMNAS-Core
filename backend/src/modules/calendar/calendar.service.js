import { createCalendarEvent, getAssignmentScheduleContext, listCalendarEventsByJobId } from "./calendar.repository.js";

function addHours(dateInput, hours) {
  return new Date(new Date(dateInput).getTime() + hours * 60 * 60 * 1000);
}

function resolveWindow(context, now = new Date()) {
  const start = context?.started_at || context?.starts_at || now.toISOString();
  const end = context?.ends_at || addHours(start, 8).toISOString();
  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString()
  };
}

export async function createShiftBlockFromAssignmentEvent({ assignmentId, jobId, workerUserId }) {
  const context = assignmentId ? await getAssignmentScheduleContext(assignmentId) : null;
  const window = resolveWindow(context);

  return createCalendarEvent({
    jobId: jobId ?? context?.job_id ?? null,
    assignmentId: assignmentId ?? context?.assignment_id ?? null,
    workerUserId: workerUserId ?? context?.worker_user_id ?? null,
    type: "SHIFT",
    title: "Assignment Accepted",
    startTime: window.startTime,
    endTime: window.endTime,
    status: "SCHEDULED"
  });
}

export async function createCalendarEventEntry(payload) {
  const now = new Date();
  const startTime = payload.startTime || now.toISOString();
  const endTime = payload.endTime || addHours(startTime, 8).toISOString();

  return createCalendarEvent({
    jobId: payload.jobId ?? null,
    assignmentId: payload.assignmentId ?? null,
    workerUserId: payload.workerUserId ?? null,
    type: payload.type || "SHIFT",
    title: payload.title || "Manual Calendar Event",
    startTime,
    endTime,
    status: payload.status || "SCHEDULED"
  });
}

export async function getCalendarEvents(jobId) {
  return listCalendarEventsByJobId(jobId ?? null);
}
