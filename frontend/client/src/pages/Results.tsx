import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, AlertCircle, Info } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { Header, PageShell } from "./shared";

const DISPLAY_ROWS = 50;

// Rows per query peptide in the CSV export. Each query contributes its own top
// hits, so a multi-peptide job exports this many rows per peptide, not in total.
const EXPORT_ROWS_PER_QUERY = 1000;

const DEFAULT_BINDING_TOOLS = [
  "NetMHCpan-EL",
  "BigMHC-EL",
  "MHCflurryEL",
  "MixMHCpred",
  "NetMHCpan",
  "NetMHC",
];

const DEFAULT_IMMUNOGENICITY_TOOLS = [
  "DeepImmuno",
  "PRIME",
  "BigMHC-IM",
];

interface ResultRow {
  rank: number | null;
  query: string;
  subject: string;
  relatedness_score: number | null;
  rds_mu?: number | null;
  rds_sigma?: number | null;
  rds_cutoff_p005?: number | null;
  rds_cutoff_p001?: number | null;
  zscore: number | null;
  pvalue: number | null;
  pvalue_adj: number | null;
  significant: boolean | null;
  num_positive: number | null;
  num_mismatch: number | null;
  peptide_length: number | null;
  resource: string | null;
  gene_donor?: string | null;
  [key: string]: unknown;
}

interface PredictionPlotMeta {
  binding_tool: string;
  immunogenicity_tool: string;
  filename?: string;
  url?: string;
}

interface FigureSet {
  expression_heatmap?: string;
  prediction_plots?: Record<string, PredictionPlotMeta>;
  binding_tools?: string[];
  immunogenicity_tools?: string[];
}

interface OutputsMeta extends FigureSet {
  // One figure set per query peptide. Jobs created before this existed carry a
  // single flat set on OutputsMeta itself.
  per_query?: Record<string, FigureSet>;
}

interface QueryMeta {
  query: string;
  start: number;
  n_rows: number;
}

interface AnalysisMetadata {
  mode?: string;
  specie?: string;
  species?: string;
  MHC_class?: string;
  allele?: string;
  outputs?: OutputsMeta;
  queries?: QueryMeta[];
  runtime_seconds?: number;
  skipped_invalid_peptides_count?: number;
  weighted?: boolean;
  custom_database?: boolean;
}

function fmtNumber(value: unknown, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toFixed(digits);
}

function fmtP(value: unknown) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
  return Number(value).toExponential(2);
}

function fmtRuntime(seconds: unknown) {
  const value = Number(seconds);
  if (seconds === null || seconds === undefined || Number.isNaN(value)) return null;
  if (value < 60) return `${value.toFixed(1)}s`;
  const minutes = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return `${minutes}m ${remainder}s`;
}

function absoluteUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}

export default function Results() {
  const [, params] = useRoute("/results/:jobId");
  const [, setLocation] = useLocation();
  const jobId = params?.jobId;

  const [results, setResults] = useState<ResultRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [queryRows, setQueryRows] = useState(0);
  const [queries, setQueries] = useState<QueryMeta[]>([]);
  const [selectedQuery, setSelectedQuery] = useState("");
  const [outputs, setOutputs] = useState<OutputsMeta>({});
  const [metadata, setMetadata] = useState<AnalysisMetadata>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bindingTool, setBindingTool] = useState(DEFAULT_BINDING_TOOLS[0]);
  const [immunogenicityTool, setImmunogenicityTool] = useState(DEFAULT_IMMUNOGENICITY_TOOLS[0]);

  useEffect(() => {
    if (!jobId) {
      setError("Job ID not found");
      setIsLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        const analysisResponse = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}/results`);
        const analysisData = await analysisResponse.json();

        if (!analysisResponse.ok || analysisData.status !== "ok") {
          throw new Error(analysisData.message || "Error processing analysis");
        }

        const responseMetadata: AnalysisMetadata = analysisData.metadata || {};
        const responseOutputs: OutputsMeta = analysisData.outputs || responseMetadata.outputs || {};
        const responseQueries = responseMetadata.queries || [];

        setTotalRows(analysisData.total_rows || 0);
        setMetadata(responseMetadata);
        setOutputs(responseOutputs);
        setQueries(responseQueries);
        // Compare mode has one global ranking and sends no query index; an
        // empty selection then means "every row", which is what it wants.
        setSelectedQuery(responseQueries[0]?.query ?? "");

        if (responseOutputs.binding_tools?.length) {
          setBindingTool(responseOutputs.binding_tools[0]);
        }
        if (responseOutputs.immunogenicity_tools?.length) {
          setImmunogenicityTool(responseOutputs.immunogenicity_tools[0]);
        }
      } catch (err) {
        console.error("Error fetching results:", err);
        const message = err instanceof Error ? err.message : "Error loading results";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [jobId]);

  // Row window for the selected query. start/end are relative to that query,
  // so each peptide shows its own top rows instead of a slice of the first one.
  useEffect(() => {
    if (!jobId || isLoading || error) return;

    const fetchRows = async () => {
      setIsLoadingRows(true);
      try {
        const params = new URLSearchParams({ start: "0", end: String(DISPLAY_ROWS) });
        if (selectedQuery) params.set("query", selectedQuery);

        const resultsResponse = await fetch(
          `${API_BASE_URL}/api/v1/job/${jobId}/results-chunked?${params.toString()}`
        );
        const resultsData = await resultsResponse.json();

        if (!resultsResponse.ok || resultsData.status !== "success") {
          throw new Error(resultsData.message || "Error loading results");
        }

        setResults(resultsData.rows || []);
        setQueryRows(resultsData.lastRow || 0);
      } catch (err) {
        console.error("Error fetching rows:", err);
        toast.error(err instanceof Error ? err.message : "Error loading results");
      } finally {
        setIsLoadingRows(false);
      }
    };

    fetchRows();
  }, [jobId, selectedQuery, isLoading, error]);

  const speciesValue = (metadata.specie || metadata.species || "").toLowerCase();
  const isCompareMode = metadata.mode === "compare";
  const isHumanAnalysis = !isCompareMode && speciesValue === "human";

  const figures: FigureSet = useMemo(() => {
    if (outputs.per_query) return outputs.per_query[selectedQuery] ?? {};
    // Jobs created before per-query figures stored one flat set, generated from
    // the first query only. Showing it for any other query would mislabel it.
    const isFirstQuery = !selectedQuery || selectedQuery === queries[0]?.query;
    return isFirstQuery ? outputs : {};
  }, [outputs, selectedQuery, queries]);

  const bindingTools = outputs.binding_tools?.length
    ? outputs.binding_tools
    : DEFAULT_BINDING_TOOLS;

  const immunogenicityTools = outputs.immunogenicity_tools?.length
    ? outputs.immunogenicity_tools
    : DEFAULT_IMMUNOGENICITY_TOOLS;

  const selectedPredictionPlot = useMemo(() => {
    const key = `${bindingTool}__${immunogenicityTool}`;
    return figures.prediction_plots?.[key];
  }, [figures, bindingTool, immunogenicityTool]);

  // The backend builds the CSV with every column and streams it. The old
  // client-side export took the first 1000 rows of the whole result, which was
  // entirely the first peptide; the limit is now per query peptide.
  const handleDownloadCSV = (query?: string) => {
    if (!jobId || totalRows === 0) return;
    const params = new URLSearchParams({ limit: String(EXPORT_ROWS_PER_QUERY) });
    if (query) params.set("query", query);
    window.location.href = `${API_BASE_URL}/api/v1/job/${jobId}/download.csv?${params.toString()}`;
  };

  const exportHint = `Top ${EXPORT_ROWS_PER_QUERY.toLocaleString()} rows per query peptide`;

  if (isLoading) {
    return (
      <PageShell>
        <Header right={<Button variant="ghost" className="glass" onClick={() => setLocation("/")}><ArrowLeft className="w-4 h-4 mr-2" />Home</Button>} />
        <main className="container pb-24 flex items-center justify-center min-h-[60vh]">
          <Card className="glass border-white/10 p-12 text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h2 className="text-2xl font-semibold">Processing analysis</h2>
            <p className="text-muted-foreground">Please wait while CrossDome analyzes your data.</p>
          </Card>
        </main>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <Header right={<Button variant="ghost" className="glass" onClick={() => setLocation("/")}><ArrowLeft className="w-4 h-4 mr-2" />Home</Button>} />
        <main className="container pb-24 flex items-center justify-center min-h-[60vh]">
          <Card className="glass border-white/10 p-12 text-center space-y-4 max-w-md">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-2xl font-semibold">Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => setLocation("/")} variant="outline" className="glass">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Card>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header
        right={
          <div className="flex flex-wrap items-center justify-end gap-4">
            <Badge variant="outline" className="glass border-primary/30 text-primary">
              {isLoadingRows ? (
                "Loading rows..."
              ) : (
                <>
                  Showing top {Math.min(DISPLAY_ROWS, queryRows).toLocaleString()} of{" "}
                  {queryRows.toLocaleString()}
                  {selectedQuery ? ` for ${selectedQuery}` : " results"}
                </>
              )}
            </Badge>
            <Button
              onClick={() => handleDownloadCSV()}
              variant="outline"
              className="glass hover:bg-white/10"
              title={exportHint}
            >
              <Download className="w-4 h-4 mr-2" />
              {queries.length > 1 ? `Export all ${queries.length} peptides` : "Export CSV"}
            </Button>
            {queries.length > 1 && (
              <Button
                onClick={() => handleDownloadCSV(selectedQuery)}
                variant="outline"
                className="glass hover:bg-white/10"
                title={exportHint}
              >
                <Download className="w-4 h-4 mr-2" />
                Export {selectedQuery}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setLocation("/")} className="glass hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              New analysis
            </Button>
          </div>
        }
      />

      <main className="container pb-24">
        <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold">Analysis Results</h1>
              <p className="text-muted-foreground">
                Job ID: <span className="font-mono text-primary">{jobId}</span>
              </p>
              {metadata.allele && (
                <p className="text-sm text-muted-foreground">Allele: {metadata.allele}</p>
              )}
              {fmtRuntime(metadata.runtime_seconds) && (
                <p className="text-sm text-muted-foreground">Runtime: {fmtRuntime(metadata.runtime_seconds)}</p>
              )}
              {metadata.skipped_invalid_peptides_count ? (
                <Badge variant="outline" className="glass border-yellow-500/40 text-yellow-500">
                  Skipped {metadata.skipped_invalid_peptides_count} invalid background peptides
                </Badge>
              ) : null}
            </div>

            {queries.length > 1 && (
              <Card className="glass border-white/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Query peptide</h2>
                  <p className="text-sm text-muted-foreground">
                    This job scored {queries.length} query peptides. Each one has its own ranking,
                    figures, and {totalRows.toLocaleString()} total rows across all peptides.
                  </p>
                </div>
                <select
                  value={selectedQuery}
                  onChange={(e) => setSelectedQuery(e.target.value)}
                  className="rounded-md bg-background border border-white/20 px-3 py-2 font-mono"
                >
                  {queries.map((item) => (
                    <option key={item.query} value={item.query}>
                      {item.query} ({item.n_rows.toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              </Card>
            )}

            {!isHumanAnalysis && !isCompareMode && (
              <Card className="glass border-white/10 p-4 flex gap-3 items-start">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold">Systems analysis table</h2>
                  <p className="text-muted-foreground">
                    Human expression and prediction plots are not generated for other-systems analyses.
                  </p>
                </div>
              </Card>
            )}

            {isHumanAnalysis && figures.expression_heatmap && (
              <Card className="glass border-white/10 p-4">
                <h2 className="text-xl font-semibold mb-4">
                  Peptide expression and tissue specificity
                  {selectedQuery && <span className="font-mono text-primary"> · {selectedQuery}</span>}
                </h2>
                <img
                  src={absoluteUrl(figures.expression_heatmap)}
                  alt="Peptide expression and tissue specificity"
                  className="w-full rounded-xl border border-white/10 bg-white"
                />
              </Card>
            )}

            {isHumanAnalysis && figures.prediction_plots && Object.keys(figures.prediction_plots).length > 0 && (
              <Card className="glass border-white/10 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      Binding and immunogenicity predictions
                      {selectedQuery && <span className="font-mono text-primary"> · {selectedQuery}</span>}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select any prediction tools available for this allele.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="text-sm">
                      Binding tool
                      <select
                        value={bindingTool}
                        onChange={(e) => setBindingTool(e.target.value)}
                        className="ml-2 rounded-md bg-background border border-white/20 px-3 py-2"
                      >
                        {bindingTools.map((tool) => (
                          <option key={tool} value={tool}>{tool}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      Immunogenicity tool
                      <select
                        value={immunogenicityTool}
                        onChange={(e) => setImmunogenicityTool(e.target.value)}
                        className="ml-2 rounded-md bg-background border border-white/20 px-3 py-2"
                      >
                        {immunogenicityTools.map((tool) => (
                          <option key={tool} value={tool}>{tool}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {selectedPredictionPlot?.url ? (
                  <img
                    src={absoluteUrl(selectedPredictionPlot.url)}
                    alt={`${bindingTool} and ${immunogenicityTool} prediction plot`}
                    className="w-full rounded-xl border border-white/10 bg-white"
                  />
                ) : (
                  <p className="text-muted-foreground">
                    No plot is available for this tool combination.
                  </p>
                )}
              </Card>
            )}

            <Card className="glass border-white/10 overflow-hidden relative">
              {isLoadingRows && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Query</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                      {isHumanAnalysis && (
                        <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                      )}
                      <th className="px-4 py-3 text-right text-sm font-semibold">RDS</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">RDS μ</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">RDS σ</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Z-score</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">P-value</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Adj. P-value</th>

                      {isHumanAnalysis && (
                        <>
                          <th className="px-4 py-3 text-right text-sm font-semibold">{bindingTool}</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">{immunogenicityTool}</th>
                        </>
                      )}

                      {!isCompareMode && (
                        <th className="px-4 py-3 text-left text-sm font-semibold">Resource</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {results.map((row, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline" className="glass border-primary/20">
                            {row.rank ?? "N/A"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-primary">{row.query}</td>
                        <td className="px-4 py-3 text-sm font-mono text-accent">{row.subject}</td>
                        {isHumanAnalysis && (
                          <td className="px-4 py-3 text-sm">{row.gene_donor || "N/A"}</td>
                        )}
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtNumber(row.relatedness_score, 3)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtNumber(row.rds_mu, 3)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtNumber(row.rds_sigma, 3)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtNumber(row.zscore, 2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtP(row.pvalue)}</td>
                        <td className="px-4 py-3 text-sm text-right font-mono">{fmtP(row.pvalue_adj)}</td>

                        {isHumanAnalysis && (
                          <>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              {fmtNumber(row[bindingTool], 3)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              {fmtNumber(row[immunogenicityTool], 3)}
                            </td>
                          </>
                        )}

                        {!isCompareMode && (
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="secondary" className="glass">
                              {row.resource || "N/A"}
                            </Badge>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-white/10 px-4 py-3 text-sm text-muted-foreground">
                Table shows the top {DISPLAY_ROWS} rows
                {selectedQuery ? <> for <span className="font-mono">{selectedQuery}</span></> : null}. CSV
                export includes the top {EXPORT_ROWS_PER_QUERY.toLocaleString()} rows per query peptide
                {queries.length > 1 ? ` (${queries.length} peptides)` : ""}. For a complete table, use the
                command-line tool (<span className="font-mono">crossdome2.py analyze</span>).
              </div>
            </Card>
          </div>
        </main>
    </PageShell>
  );
}
