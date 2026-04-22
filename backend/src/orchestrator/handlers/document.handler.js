import { evaluateAndPatchJobDocGating } from "../../modules/documents/documents.gating.js";

async function reEvaluateJobGating(jobId, eventName) {
  if (!jobId) {
    console.warn(`[DocumentHandler] ${eventName} received no jobId — skipping gating evaluation`);
    return;
  }
  try {
    const gating = await evaluateAndPatchJobDocGating(Number(jobId));
    console.log(`[DocumentHandler] ${eventName} jobId=${jobId} → gating.state=${gating.state}`);
  } catch (err) {
    console.error(`[DocumentHandler] ${eventName} gating evaluation failed:`, err.message);
  }
}

export async function handleDocApproved(payload) {
  await reEvaluateJobGating(payload.jobId, "ON_DOC_APPROVED");
}

export async function handleDocPartiallyApproved(payload) {
  await reEvaluateJobGating(payload.jobId, "ON_DOC_PARTIALLY_APPROVED");
}

export async function handleDocRejected(payload) {
  await reEvaluateJobGating(payload.jobId, "ON_DOC_REJECTED");
}
