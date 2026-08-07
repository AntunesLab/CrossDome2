export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000";

export type MhcClass = "I" | "II";
export type Species = "human" | "humanized" | "mouse" | "rat" | "swine" | "bovine" | "chicken" | "dog";

export async function fetchAlleles(species: Species, mhcClass: MhcClass): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/v1/alleles?specie=${encodeURIComponent(species)}&MHC_class=${mhcClass}`);
  const data = await response.json();
  if (!response.ok || data.status !== "ok") throw new Error(data.message || "Could not load alleles.");
  return data.alleles || [];
}

export function buildAnalysisFormData(args: {
  species: Species;
  mhcClass: MhcClass;
  allele: string;
  subjectInputType: "text" | "file";
  subjectText: string;
  subjectFile: File | null;
  customDatabase: File | null;
  tcrWeights: string;
}) {
  const form = new FormData();
  form.set("mode", "analyze");
  form.set("specie", args.species);
  form.set("MHC_class", args.mhcClass);
  form.set("targetHLA", args.allele);
  form.set("subjectInputType", args.subjectInputType);
  if (args.subjectInputType === "file" && args.subjectFile) form.set("subjectFile", args.subjectFile);
  else form.set("subjectText", args.subjectText);
  if (args.customDatabase) form.set("customDatabase", args.customDatabase);
  if (args.tcrWeights.trim()) form.set("tcrWeights", args.tcrWeights.trim());
  return form;
}

export function buildCompareFormData(args: {
  subjectInputType: "text" | "file";
  subjectText: string;
  subjectFile: File | null;
  targetInputType: "text" | "file";
  targetText: string;
  targetFile: File | null;
  tcrWeights: string;
}) {
  const form = new FormData();
  form.set("mode", "compare");
  form.set("subjectInputType", args.subjectInputType);
  form.set("targetInputType", args.targetInputType);
  if (args.subjectInputType === "file" && args.subjectFile) form.set("subjectFile", args.subjectFile);
  else form.set("subjectText", args.subjectText);
  if (args.targetInputType === "file" && args.targetFile) form.set("targetFile", args.targetFile);
  else form.set("targetText", args.targetText);
  if (args.tcrWeights.trim()) form.set("tcrWeights", args.tcrWeights.trim());
  return form;
}

export async function submitCrossDomeJob(form: FormData): Promise<string> {
  const response = await fetch(`${API_BASE}/api/v1/submitform`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok || data.status !== "ok") throw new Error(data.message || "Submission failed.");
  return data.job_id;
}
