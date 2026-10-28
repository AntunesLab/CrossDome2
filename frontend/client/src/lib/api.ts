export const API_BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:5000";

// Kept in step with MAX_ANALYZE_QUERIES in backend/crossdome/runner.py, which
// is the authoritative check. Counting here only avoids a wasted round trip.
export const MAX_ANALYZE_PEPTIDES = 10;

const VALID_PEPTIDE = /^[ACDEFGHIKLMNPQRSTVWY]{8,25}$/;

/**
 * Count the query peptides a submission would produce, mirroring the backend's
 * parse_peptide_text: split, normalize, drop invalid tokens, de-duplicate. A
 * CSV header or a stray blank line therefore does not count against the limit.
 */
export function countQueryPeptides(text: string): number {
  const valid = text
    .split(/[\s,;]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => VALID_PEPTIDE.test(token));
  return new Set(valid).size;
}

export type MhcClass = "I" | "II";
export type Species = "human" | "humanized" | "mouse" | "bovine" | "swine" | "chicken" | "rat" | "dogsl";

export interface AlleleResponse {
  status: "ok" | "error";
  species: string;
  MHC_class: MhcClass;
  alleles: string[];
  message?: string;
}

export async function fetchAlleles(species: string, mhcClass: MhcClass): Promise<string[]> {
  const params = new URLSearchParams({ specie: species, MHC_class: mhcClass });
  const response = await fetch(`${API_BASE_URL}/api/v1/alleles?${params.toString()}`);
  const data = (await response.json()) as AlleleResponse;

  if (!response.ok || data.status !== "ok") {
    throw new Error(data.message || "Unable to load allele list");
  }

  return data.alleles;
}

export function buildAnalysisFormData(params: {
  mode: "analyze";
  species: string;
  mhcClass: MhcClass;
  allele: string;
  subjectInputType: "text" | "file";
  subjectText?: string;
  subjectFile?: File | null;
}) {
  const formData = new FormData();
  formData.append("mode", params.mode);
  formData.append("specie", params.species);
  formData.append("MHC_class", params.mhcClass);
  formData.append("targetHLA", params.allele);
  formData.append("subjectInputType", params.subjectInputType);

  if (params.subjectInputType === "text") {
    formData.append("subjectText", params.subjectText ?? "");
  } else if (params.subjectFile) {
    formData.append("subjectFile", params.subjectFile);
  }

  return formData;
}

export function buildCompareFormData(params: {
  subjectInputType: "text" | "file";
  subjectText?: string;
  subjectFile?: File | null;
  targetInputType: "text" | "file";
  targetText?: string;
  targetFile?: File | null;
}) {
  const formData = new FormData();
  formData.append("mode", "compare");
  formData.append("subjectInputType", params.subjectInputType);
  formData.append("targetInputType", params.targetInputType);

  if (params.subjectInputType === "text") {
    formData.append("subjectText", params.subjectText ?? "");
  } else if (params.subjectFile) {
    formData.append("subjectFile", params.subjectFile);
  }

  if (params.targetInputType === "text") {
    formData.append("targetText", params.targetText ?? "");
  } else if (params.targetFile) {
    formData.append("targetFile", params.targetFile);
  }

  return formData;
}

export async function submitCrossDomeJob(formData: FormData): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/submitform`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || data.status !== "ok") {
    throw new Error(data.message || "Error submitting analysis");
  }

  return data.job_id as string;
}

// Job states as the asynchronous deployment reports them. Several spellings are
// accepted because the status endpoint is a deployment-side layer, not part of
// this repo's backend, so its vocabulary is not ours to fix.
const COMPLETE_STATES = new Set(["complete", "completed", "done", "finished"]);
const FAILED_STATES = new Set(["error", "failed"]);
const PENDING_STATES = new Set(["pending", "queued", "running", "in_progress", "processing", "started"]);

const STATUS_POLL_MS = 3000;

// A web analyze job is capped at MAX_ANALYZE_PEPTIDES, so a few minutes is the
// normal remote runtime. The ceiling only stops the page polling a wedged job
// forever; the job id stays valid, so the link still works afterwards.
const STATUS_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * "complete" once the job is finished, or "unsupported" when this deployment
 * answers no job status endpoint. The backend in this repo is one of those: it
 * runs the computation inside the first GET /job/<id>/results, which blocks
 * until the result is ready, so there is nothing to poll and the caller should
 * go straight to that request.
 */
export type JobWaitResult = "complete" | "unsupported";

/**
 * Wait for an asynchronous backend to finish a job before its results are read.
 *
 * Returning "unsupported" rather than throwing on anything unrecognized is
 * deliberate: a missing or unfamiliar status endpoint is not evidence that the
 * analysis failed, and the blocking results call still works in that case.
 */
export async function waitForJobComplete(
  jobId: string,
  options: { signal?: AbortSignal; onProgress?: (state: string) => void } = {}
): Promise<JobWaitResult> {
  const deadline = Date.now() + STATUS_TIMEOUT_MS;

  for (;;) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}/status`, { signal: options.signal });
    } catch (err) {
      if (options.signal?.aborted) throw err;
      return "unsupported";
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(await response.text());
    } catch {
      // Flask answers an unknown route with an HTML 404, and CloudFront masks a
      // missed origin as 200 plus the SPA shell. Neither is a job state.
      return "unsupported";
    }

    const state = String(payload?.job_status ?? payload?.status ?? "").toLowerCase();

    if (COMPLETE_STATES.has(state)) return "complete";
    if (FAILED_STATES.has(state)) {
      throw new Error(String(payload?.message || payload?.error || "Analysis failed"));
    }
    if (!PENDING_STATES.has(state)) {
      // Covers the {"status": "ok"} envelope of a route that is not a job
      // status at all: unrecognized means unknown, not unfinished.
      return "unsupported";
    }

    options.onProgress?.(state);

    if (Date.now() >= deadline) {
      throw new Error(
        "The analysis is still running after 30 minutes. Keep this link -- the results appear here once it finishes."
      );
    }
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
  }
}
