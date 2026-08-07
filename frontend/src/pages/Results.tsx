import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import Layout from "./Layout";
import { API_BASE } from "../lib/api";

const DISPLAY_ROWS = 30;
const bindingDefault = ["BigMHC-EL", "NetMHCpan-EL"];
const immunoDefault = ["DeepImmuno", "TLImm"];

type Row = Record<string, string | number | boolean | null>;

type Outputs = {
  expression_heatmap?: string;
  prediction_plots?: Record<string, { url?: string; binding_tool: string; immunogenicity_tool: string }>;
  binding_tools?: string[];
  immunogenicity_tools?: string[];
};

function fmt(v: unknown, digits = 3) { const n = Number(v); return v === null || v === undefined || Number.isNaN(n) ? "N/A" : n.toFixed(digits); }
function pFmt(v: unknown) { const n = Number(v); return v === null || v === undefined || Number.isNaN(n) ? "N/A" : n.toExponential(2); }
function abs(url?: string) { return !url ? "" : url.startsWith("http") ? url : API_BASE + url; }

export default function Results() {
  const [, params] = useRoute("/results/:jobId"); const jobId = params?.jobId || "";
  const [rows, setRows] = useState<Row[]>([]), [total, setTotal] = useState(0), [metadata, setMetadata] = useState<Record<string, any>>({}), [outputs, setOutputs] = useState<Outputs>({});
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [binding, setBinding] = useState(bindingDefault[0]), [immuno, setImmuno] = useState(immunoDefault[0]);

  useEffect(() => { (async () => { try { const r = await fetch(`${API_BASE}/api/v1/job/${jobId}/results`); const d = await r.json(); if (!r.ok || d.status !== "ok") throw new Error(d.message || "Analysis failed"); setTotal(d.total_rows || 0); setMetadata(d.metadata || {}); setOutputs(d.outputs || {}); if (d.outputs?.binding_tools?.length) setBinding(d.outputs.binding_tools[0]); if (d.outputs?.immunogenicity_tools?.length) setImmuno(d.outputs.immunogenicity_tools[0]); const rr = await fetch(`${API_BASE}/api/v1/job/${jobId}/results-chunked?start=0&end=${DISPLAY_ROWS}`); const rd = await rr.json(); if (rd.status !== "success") throw new Error(rd.message || "Could not load rows"); setRows(rd.rows || []); } catch (e) { setError(e instanceof Error ? e.message : "Could not load results"); } finally { setLoading(false); } })(); }, [jobId]);

  const human = metadata.species === "human" && metadata.mode === "analyze";
  const prediction = useMemo(() => outputs.prediction_plots?.[`${binding}__${immuno}`], [outputs, binding, immuno]);
  const bindingTools = outputs.binding_tools || bindingDefault, immunoTools = outputs.immunogenicity_tools || immunoDefault;
  const baseCols = ["rank", "query", "subject", "relatedness_score", "rds_mu", "rds_sigma", "rds_cutoff_p005", "rds_cutoff_p001", "zscore", "pvalue", "pvalue_adj", "significant", "num_positive", "num_mismatch"];
  const columns = human ? [...baseCols, binding, immuno, "resource"] : [...baseCols, "resource"].filter((c, i, a) => a.indexOf(c) === i);

  if (loading) return <Layout><div className="card status">Processing CrossDome analysis…</div></Layout>;
  if (error) return <Layout><div className="card status error">{error}<br /><Link href="/">Return home</Link></div></Layout>;

  return <Layout><section className="results-head"><div><span className="eyebrow">Job complete</span><h1>Analysis results</h1><p className="muted">Showing {Math.min(DISPLAY_ROWS, total)} of {total} rows · {metadata.allele || "direct comparison"}</p></div><a className="button secondary" href={`${API_BASE}/api/v1/job/${jobId}/download.csv`}>Download full CSV</a></section>
    {human && outputs.expression_heatmap && <article className="card plot-card"><h2>Expression heatmap</h2><img src={abs(outputs.expression_heatmap)} alt="Expression heatmap" /></article>}
    {human && <article className="card plot-card"><div className="plot-controls"><h2>Binding and immunogenicity predictions</h2><div><select value={binding} onChange={e => setBinding(e.target.value)}>{bindingTools.map(t => <option key={t}>{t}</option>)}</select><select value={immuno} onChange={e => setImmuno(e.target.value)}>{immunoTools.map(t => <option key={t}>{t}</option>)}</select></div></div>{prediction?.url ? <img src={abs(prediction.url)} alt="Prediction plot" /> : <p className="muted">No prediction values are available for this tool combination.</p>}</article>}
    <article className="card table-card"><div className="table-wrap"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map(c => <td key={c}>{c === "pvalue" || c === "pvalue_adj" ? pFmt(row[c]) : typeof row[c] === "number" ? fmt(row[c]) : String(row[c] ?? "N/A")}</td>)}</tr>)}</tbody></table></div></article>
  </Layout>;
}
