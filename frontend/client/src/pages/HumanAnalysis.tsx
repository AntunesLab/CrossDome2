import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { buildAnalysisFormData, fetchAlleles, submitCrossDomeJob, type MhcClass } from "@/lib/api";
import { MHC_CLASSES } from "@/lib/mhcAlleles";
import { Header, PageShell } from "./shared";

export default function HumanAnalysis() {
  const [, setLocation] = useLocation();
  const [subjectInputType, setSubjectInputType] = useState<"text" | "file">("text");
  const [subjectText, setSubjectText] = useState("");
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [customDatabase, setCustomDatabase] = useState<File | null>(null);
  const [mhcClass, setMhcClass] = useState<MhcClass>("I");
  const [alleles, setAlleles] = useState<string[]>([]);
  const [alleleQuery, setAlleleQuery] = useState("");
  const [selectedAllele, setSelectedAllele] = useState("");
  const [tcrWeights, setTcrWeights] = useState("");
  const [isLoadingAlleles, setIsLoadingAlleles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedAllele("");
    setAlleleQuery("");
    setIsLoadingAlleles(true);
    fetchAlleles("human", mhcClass)
      .then(setAlleles)
      .catch((error) => toast.error(error.message))
      .finally(() => setIsLoadingAlleles(false));
  }, [mhcClass]);

  const filteredAlleles = useMemo(() => {
    const q = alleleQuery.trim().toLowerCase();
    if (!q) return alleles;
    return alleles.filter((allele) => allele.toLowerCase().includes(q));
  }, [alleleQuery, alleles]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (subjectInputType === "text" && !subjectText.trim()) {
      toast.error("Please enter at least one query peptide.");
      return;
    }
    if (subjectInputType === "file" && !subjectFile) {
      toast.error("Please select a query peptide file.");
      return;
    }
    if (!selectedAllele) {
      toast.error("Please select an HLA allele.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = buildAnalysisFormData({
        mode: "analyze",
        species: "human",
        mhcClass,
        allele: selectedAllele,
        subjectInputType,
        subjectText,
        subjectFile,
      });
      if (customDatabase) formData.append("customDatabase", customDatabase);
      if (tcrWeights.trim()) formData.append("tcrWeights", tcrWeights.trim());
      const jobId = await submitCrossDomeJob(formData);
      toast.success("Human analysis submitted successfully.");
      setLocation(`/results/${jobId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error submitting analysis.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <Header
        right={
          <Button variant="ghost" className="glass" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
        }
      />
      <main className="container pb-24">
        <Card className="glass border-white/10 p-8 max-w-4xl mx-auto">
          <div className="space-y-2 mb-8">
            <Badge variant="outline" className="border-primary/30 text-primary">Expression-enabled workflow</Badge>
            <h2 className="text-3xl font-bold">Human peptide analysis</h2>
            <p className="text-muted-foreground">
              Human is the only workflow with expression data. The backend will use the human class-specific database and return expression-derived outputs when available.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <Label>Query peptide input</Label>
              <RadioGroup value={subjectInputType} onValueChange={(v) => setSubjectInputType(v as "text" | "file")} className="flex gap-6">
                <div className="flex items-center space-x-2"><RadioGroupItem value="text" id="human-text" /><Label htmlFor="human-text">Text</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="human-file" /><Label htmlFor="human-file">CSV/TXT file</Label></div>
              </RadioGroup>
              {subjectInputType === "text" ? (
                <Textarea
                  value={subjectText}
                  onChange={(e) => setSubjectText(e.target.value)}
                  placeholder="LLFGYPVYV, ACDEFGHIK, YLLPAIVHI"
                  className="min-h-32 glass"
                />
              ) : (
                <div className="space-y-2">
                  <Input type="file" accept=".csv,.txt" onChange={(e) => setSubjectFile(e.target.files?.[0] ?? null)} className="glass" />
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" />CSV or TXT with peptide sequences.</p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>MHC class</Label>
                <Select value={mhcClass} onValueChange={(v) => setMhcClass(v as MhcClass)}>
                  <SelectTrigger className="glass"><SelectValue /></SelectTrigger>
                  <SelectContent>{MHC_CLASSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search HLA allele</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input className="glass pl-9" value={alleleQuery} onChange={(e) => setAlleleQuery(e.target.value)} placeholder="Search, e.g. HLA-A*02:01" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>HLA allele</Label>
              <Select value={selectedAllele} onValueChange={setSelectedAllele} disabled={isLoadingAlleles || filteredAlleles.length === 0}>
                <SelectTrigger className="glass"><SelectValue placeholder={isLoadingAlleles ? "Loading alleles..." : "Select allele"} /></SelectTrigger>
                <SelectContent>{filteredAlleles.map((allele) => <SelectItem key={allele} value={allele}>{allele}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional peptide database (optional)</Label>
              <Input
                type="file"
                accept=".csv,.txt,.parquet"
                onChange={(e) => setCustomDatabase(e.target.files?.[0] ?? null)}
                className="glass"
              />
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Upload className="w-4 h-4" />CSV, TXT, or Parquet with a peptide_sequence column. Peptides are appended to the selected CrossDome database.
              </p>
            </div>


            <div className="space-y-2">
              <Label>Optional TCR position weights</Label>
              <Textarea
                value={tcrWeights}
                onChange={(e) => setTcrWeights(e.target.value)}
                placeholder="Example for a 9-mer: 1,1,1,1,1,1,1,1,1"
                className="min-h-20 glass"
              />
              <p className="text-sm text-muted-foreground">
                Enter one numeric weight per peptide position. The number of weights must match the query peptide length. Leave blank to use equal weights.
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start human analysis
            </Button>
          </form>
        </Card>
      </main>
    </PageShell>
  );
}
