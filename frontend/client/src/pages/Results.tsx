import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, AlertCircle, Info } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

const DISPLAY_ROWS = 30;

const DEFAULT_BINDING_TOOLS = [
  "BigMHC-EL",
  "NetMHC",
  "NetMHCpan",
  "NetMHCpan-EL",
  "MixMHCpred",
  "MHCflurryEL",
];

const DEFAULT_IMMUNOGENICITY_TOOLS = [
  "BigMHC_IM",
  "PRIME",
  "DeepImmuno",
  "TLImm",
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

interface OutputsMeta {
  expression_heatmap?: string;
  prediction_plots?: Record<string, PredictionPlotMeta>;
  binding_tools?: string[];
  immunogenicity_tools?: string[];
}

interface AnalysisMetadata {
  mode?: string;
  specie?: string;
  species?: string;
  MHC_class?: string;
  allele?: string;
  outputs?: OutputsMeta;
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
  const [outputs, setOutputs] = useState<OutputsMeta>({});
  const [metadata, setMetadata] = useState<AnalysisMetadata>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bindingTool, setBindingTool] = useState(DEFAULT_BINDING_TOOLS[0]);
  const [immunogenicityTool, setImmunogenicityTool] = useState(DEFAULT_IMMUNOGENICITY_TOOLS[0]);

  useEffect(() => {
    if (!jobId) {
      setError("Job ID not found");
      setIsLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        const analysisResponse = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}/results`);
        const analysisData = await analysisResponse.json();

        if (!analysisResponse.ok || analysisData.status !== "ok") {
          throw new Error(analysisData.message || "Error processing analysis");
        }

        const responseMetadata: AnalysisMetadata = analysisData.metadata || {};
        const responseOutputs: OutputsMeta = analysisData.outputs || responseMetadata.outputs || {};

        setTotalRows(analysisData.total_rows || 0);
        setMetadata(responseMetadata);
        setOutputs(responseOutputs);

        if (responseOutputs.binding_tools?.length) {
          setBindingTool(responseOutputs.binding_tools[0]);
        }
        if (responseOutputs.immunogenicity_tools?.length) {
          setImmunogenicityTool(responseOutputs.immunogenicity_tools[0]);
        }

        const resultsResponse = await fetch(
          `${API_BASE_URL}/api/v1/job/${jobId}/results-chunked?start=0&end=${DISPLAY_ROWS}`
        );
        const resultsData = await resultsResponse.json();

        if (!resultsResponse.ok || resultsData.status !== "success") {
          throw new Error(resultsData.message || "Error loading results");
        }

        setResults(resultsData.rows || []);
      } catch (err) {
        console.error("Error fetching results:", err);
        const message = err instanceof Error ? err.message : "Error loading results";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [jobId]);

  const speciesValue = (metadata.specie || metadata.species || "").toLowerCase();
  const isCompareMode = metadata.mode === "compare";
  const isHumanAnalysis = !isCompareMode && speciesValue === "human";

  const bindingTools = outputs.binding_tools?.length
    ? outputs.binding_tools
    : DEFAULT_BINDING_TOOLS;

  const immunogenicityTools = outputs.immunogenicity_tools?.length
    ? outputs.immunogenicity_tools
    : DEFAULT_IMMUNOGENICITY_TOOLS;

  const selectedPredictionPlot = useMemo(() => {
    const key = `${bindingTool}__${immunogenicityTool}`;
    return outputs.prediction_plots?.[key];
  }, [outputs, bindingTool, immunogenicityTool]);

  const handleDownloadCSV = async () => {
    if (!jobId || totalRows === 0) return;

    try {
      // Prefer the backend CSV endpoint because it preserves every result column.
      const response = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}/download.csv`);
      if (!response.ok) {
        throw new Error("CSV export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crossdome-full-results-${jobId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Full results exported successfully");
    } catch (err) {
      console.error("CSV export failed:", err);
      toast.error("CSV export failed");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 z-0 bg-background" />
        <Card className="glass border-white/10 p-12 text-center space-y-4 relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <h2 className="text-2xl font-semibold">Processing analysis</h2>
          <p className="text-muted-foreground">Please wait while CrossDome analyzes your data.</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 z-0 bg-background" />
        <Card className="glass border-white/10 p-12 text-center space-y-4 relative z-10 max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-2xl font-semibold">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => setLocation("/")} variant="outline" className="glass">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-background" />

      <div className="relative z-10">
        <header className="container py-8">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" onClick={() => setLocation("/")} className="glass hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              New analysis
            </Button>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className="glass border-primary/30 text-primary">
                Showing top {Math.min(DISPLAY_ROWS, totalRows)} of {totalRows} results
              </Badge>
              <Button onClick={handleDownloadCSV} variant="outline" className="glass hover:bg-white/10">
                <Download className="w-4 h-4 mr-2" />
                Export full CSV
              </Button>
            </div>
          </div>
        </header>

        <section className="container pb-24">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold">Analysis Results</h1>
              <p className="text-muted-foreground">
                Job ID: <span className="font-mono text-primary">{jobId}</span>
              </p>
              {metadata.allele && (
                <p className="text-sm text-muted-foreground">Allele: {metadata.allele}</p>
              )}
              {metadata.skipped_invalid_peptides_count ? (
                <Badge variant="outline" className="glass border-yellow-500/40 text-yellow-500">
                  Skipped {metadata.skipped_invalid_peptides_count} invalid background peptides
                </Badge>
              ) : null}
            </div>

            {!isHumanAnalysis && !isCompareMode && (
              <Card className="glass border-white/10 p-4 flex gap-3 items-start">
                <Info className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold">Species analysis table</h2>
                  <p className="text-muted-foreground">
                    Human expression and prediction plots are not generated for other-species analyses.
                  </p>
                </div>
              </Card>
            )}

            {isHumanAnalysis && outputs.expression_heatmap && (
              <Card className="glass border-white/10 p-4">
                <h2 className="text-xl font-semibold mb-4">Peptide expression and tissue specificity</h2>
                <img
                  src={absoluteUrl(outputs.expression_heatmap)}
                  alt="Peptide expression and tissue specificity"
                  className="w-full rounded-xl border border-white/10 bg-white"
                />
              </Card>
            )}

            {isHumanAnalysis && outputs.prediction_plots && Object.keys(outputs.prediction_plots).length > 0 && (
              <Card className="glass border-white/10 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">Binding and immunogenicity predictions</h2>
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

            <Card className="glass border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Rank</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Query</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Subject</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">RdS</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">RdS μ</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">RdS σ</th>
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
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
