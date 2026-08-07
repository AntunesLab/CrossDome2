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
import { buildAnalysisFormData, fetchAlleles, submitCrossDomeJob, type MhcClass, type Species } from "@/lib/api";
import { ANALYSIS_SPECIES, MHC_CLASSES } from "@/lib/mhcAlleles";
import { Header, PageShell } from "./shared";

const NON_HUMAN_SPECIES = ANALYSIS_SPECIES.filter((species) => species.value !== "human");

export default function SpeciesAnalysis() {
  const [, setLocation] = useLocation();
  const [subjectInputType, setSubjectInputType] = useState<"text" | "file">("text");
  const [subjectText, setSubjectText] = useState("");
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [customDatabase, setCustomDatabase] = useState<File | null>(null);
  const [species, setSpecies] = useState<Species>("mouse");
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
    fetchAlleles(species, mhcClass)
      .then(setAlleles)
      .catch((error) => {
        setAlleles([]);
        toast.error(error.message);
      })
      .finally(() => setIsLoadingAlleles(false));
  }, [species, mhcClass]);

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
      toast.error("Please select an allele.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = buildAnalysisFormData({
        mode: "analyze",
        species,
        mhcClass,
        allele: selectedAllele,
        subjectInputType,
        subjectText,
        subjectFile,
      });
      if (customDatabase) formData.append("customDatabase", customDatabase);
      if (tcrWeights.trim()) formData.append("tcrWeights", tcrWeights.trim());
      const jobId = await submitCrossDomeJob(formData);
      toast.success("Species analysis submitted successfully.");
      setLocation(`/results/${jobId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error submitting analysis.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell>
      <Header right={<Button variant="ghost" className="glass" onClick={() => setLocation("/")}><ArrowLeft className="w-4 h-4 mr-2" />Home</Button>} />
      <main className="container pb-24">
        <Card className="glass border-white/10 p-8 max-w-4xl mx-auto">
          <div className="space-y-2 mb-8">
            <Badge variant="outline" className="border-primary/30 text-primary">Species-specific workflow</Badge>
            <h2 className="text-3xl font-bold">Other species analysis</h2>
            <p className="text-muted-foreground">
              Select the species, MHC class, and allele. Expression outputs and dynamic prediction visualizations are hidden for this workflow because expression data are only available for human. The results page will show a static top-30 table with full CSV download.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <Label>Query peptide input</Label>
              <RadioGroup value={subjectInputType} onValueChange={(v) => setSubjectInputType(v as "text" | "file")} className="flex gap-6">
                <div className="flex items-center space-x-2"><RadioGroupItem value="text" id="species-text" /><Label htmlFor="species-text">Text</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="species-file" /><Label htmlFor="species-file">CSV/TXT file</Label></div>
              </RadioGroup>
              {subjectInputType === "text" ? (
                <Textarea value={subjectText} onChange={(e) => setSubjectText(e.target.value)} placeholder="LLFGYPVYV, ACDEFGHIK, YLLPAIVHI" className="min-h-32 glass" />
              ) : (
                <div className="space-y-2"><Input type="file" accept=".csv,.txt" onChange={(e) => setSubjectFile(e.target.files?.[0] ?? null)} className="glass" /><p className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" />CSV or TXT with peptide sequences.</p></div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Species</Label>
                <Select value={species} onValueChange={(v) => setSpecies(v as Species)}>
                  <SelectTrigger className="glass"><SelectValue /></SelectTrigger>
                  <SelectContent>{NON_HUMAN_SPECIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>MHC class</Label>
                <Select value={mhcClass} onValueChange={(v) => setMhcClass(v as MhcClass)}>
                  <SelectTrigger className="glass"><SelectValue /></SelectTrigger>
                  <SelectContent>{MHC_CLASSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Search allele</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input className="glass pl-9" value={alleleQuery} onChange={(e) => setAlleleQuery(e.target.value)} placeholder="Search available alleles" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Allele</Label>
                <Select value={selectedAllele} onValueChange={setSelectedAllele} disabled={isLoadingAlleles || filteredAlleles.length === 0}>
                  <SelectTrigger className="glass"><SelectValue placeholder={isLoadingAlleles ? "Loading alleles..." : filteredAlleles.length ? "Select allele" : "No alleles found"} /></SelectTrigger>
                  <SelectContent>{filteredAlleles.map((allele) => <SelectItem key={allele} value={allele}>{allele}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional peptide database (optional)</Label>
              <Input type="file" accept=".csv,.txt,.parquet" onChange={(e) => setCustomDatabase(e.target.files?.[0] ?? null)} className="glass" />
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" />CSV, TXT, or Parquet with a peptide_sequence column. Peptides are appended to the selected CrossDome database.</p>
            </div>

            <div className="space-y-2">
              <Label>Optional TCR position weights</Label>
              <Textarea value={tcrWeights} onChange={(e) => setTcrWeights(e.target.value)} placeholder="Example for a 9-mer: 1,1,1,1,1,1,1,1,1" className="min-h-20 glass" />
              <p className="text-sm text-muted-foreground">Enter one numeric weight per peptide position. Leave blank to use equal weights.</p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start species analysis
            </Button>
          </form>
        </Card>
      </main>
    </PageShell>
  );
}
