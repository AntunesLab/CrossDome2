import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import Layout from "./Layout";
import { buildAnalysisFormData, fetchAlleles, submitCrossDomeJob, type MhcClass, type Species } from "../lib/api";
import { MHC_CLASSES, SPECIES } from "../lib/options";

export default function Analysis({ human }: { human: boolean }) {
  const [, navigate] = useLocation();
  const [species, setSpecies] = useState<Species>(human ? "human" : "mouse");
  const [mhcClass, setMhcClass] = useState<MhcClass>("I");
  const [alleles, setAlleles] = useState<string[]>([]);
  const [allele, setAllele] = useState("");
  const [filter, setFilter] = useState("");
  const [inputType, setInputType] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [customDb, setCustomDb] = useState<File | null>(null);
  const [weights, setWeights] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAllele(""); setError("");
    fetchAlleles(species, mhcClass).then(setAlleles).catch((e) => { setAlleles([]); setError(e.message); });
  }, [species, mhcClass]);

  const visibleAlleles = useMemo(() => alleles.filter(a => a.toLowerCase().includes(filter.toLowerCase())), [alleles, filter]);
  const speciesOptions = human ? SPECIES.filter(x => x.value === "human") : SPECIES.filter(x => x.value !== "human");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!allele) return setError("Select an allele.");
    if (inputType === "text" && !text.trim()) return setError("Enter at least one peptide.");
    if (inputType === "file" && !file) return setError("Select a peptide file.");
    setLoading(true);
    try {
      const form = buildAnalysisFormData({ species, mhcClass, allele, subjectInputType: inputType, subjectText: text, subjectFile: file, customDatabase: customDb, tcrWeights: weights });
      const jobId = await submitCrossDomeJob(form);
      navigate(`/results/${jobId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Submission failed."); }
    finally { setLoading(false); }
  }

  return (
    <Layout>
      <form className="card form-card" onSubmit={submit}>
        <div><span className="eyebrow">{human ? "Human workflow" : "Species workflow"}</span><h1>{human ? "Human peptide analysis" : "Other species analysis"}</h1></div>
        {error && <div className="error">{error}</div>}

        <label>Query peptide input</label>
        <div className="inline-controls"><label><input type="radio" checked={inputType === "text"} onChange={() => setInputType("text")} /> Text</label><label><input type="radio" checked={inputType === "file"} onChange={() => setInputType("file")} /> CSV/TXT file</label></div>
        {inputType === "text" ? <textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="LLFGYPVYV, ACDEFGHIK" /> : <input type="file" accept=".csv,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />}

        <div className="two-cols">
          <div><label>Species</label><select value={species} onChange={e => setSpecies(e.target.value as Species)}>{speciesOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          <div><label>MHC class</label><select value={mhcClass} onChange={e => setMhcClass(e.target.value as MhcClass)}>{MHC_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        </div>

        <label>Search allele</label><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="HLA-A*02:01" />
        <label>Allele</label><select value={allele} onChange={e => setAllele(e.target.value)}><option value="">Select allele</option>{visibleAlleles.map(a => <option key={a} value={a}>{a}</option>)}</select>

        <label>Additional peptide database <span className="muted">(optional)</span></label>
        <input type="file" accept=".csv,.tsv,.txt,.parquet" onChange={e => setCustomDb(e.target.files?.[0] || null)} />
        <small className="muted">A tabular custom database should contain a peptide_sequence column. Peptides are assigned to the selected allele for this run.</small>

        <label>TCR position weights <span className="muted">(optional)</span></label>
        <input value={weights} onChange={e => setWeights(e.target.value)} placeholder="1, 1, 1.4, 2, 2, 1.4, 1, 1, 1" />
        <small className="muted">Comma- or space-separated numeric weights. The number of weights must match the query peptide length.</small>

        <button className="button" disabled={loading}>{loading ? "Submitting…" : "Start analysis"}</button>
      </form>
    </Layout>
  );
}
