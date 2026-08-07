import { useState } from "react";
import { useLocation } from "wouter";
import Layout from "./Layout";
import { buildCompareFormData, submitCrossDomeJob } from "../lib/api";

function PeptideInput({ title, type, setType, text, setText, setFile }: { title: string; type: "text" | "file"; setType: (v: "text" | "file") => void; text: string; setText: (v: string) => void; setFile: (f: File | null) => void }) {
  return <div className="input-block"><label>{title}</label><div className="inline-controls"><label><input type="radio" checked={type === "text"} onChange={() => setType("text")} /> Text</label><label><input type="radio" checked={type === "file"} onChange={() => setType("file")} /> CSV/TXT file</label></div>{type === "text" ? <textarea rows={5} value={text} onChange={e => setText(e.target.value)} /> : <input type="file" accept=".csv,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />}</div>;
}

export default function Compare() {
  const [, navigate] = useLocation();
  const [st, setSt] = useState<"text" | "file">("text"), [tt, setTt] = useState<"text" | "file">("text");
  const [sText, setSText] = useState(""), [tText, setTText] = useState("");
  const [sFile, setSFile] = useState<File | null>(null), [tFile, setTFile] = useState<File | null>(null);
  const [weights, setWeights] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const form = buildCompareFormData({ subjectInputType: st, subjectText: sText, subjectFile: sFile, targetInputType: tt, targetText: tText, targetFile: tFile, tcrWeights: weights });
      const jobId = await submitCrossDomeJob(form); navigate(`/results/${jobId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Submission failed."); }
    finally { setLoading(false); }
  }

  return <Layout><form className="card form-card" onSubmit={submit}><span className="eyebrow">Direct comparison</span><h1>Compare peptides</h1><p className="muted">Only equal-length peptide pairs are scored. Each valid pair uses the corresponding length-specific RdS distribution.</p>{error && <div className="error">{error}</div>}<PeptideInput title="Subject peptides" type={st} setType={setSt} text={sText} setText={setSText} setFile={setSFile} /><PeptideInput title="Target peptides" type={tt} setType={setTt} text={tText} setText={setTText} setFile={setTFile} /><label>TCR position weights <span className="muted">(optional)</span></label><input value={weights} onChange={e => setWeights(e.target.value)} placeholder="1, 1, 1.4, 2, 2, 1.4, 1, 1, 1" /><button className="button" disabled={loading}>{loading ? "Submitting…" : "Start comparison"}</button></form></Layout>;
}
