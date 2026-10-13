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
