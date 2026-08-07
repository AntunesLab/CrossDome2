import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { buildCompareFormData, submitCrossDomeJob } from "@/lib/api";
import { Header, PageShell } from "./shared";

function PeptideInput({
  label,
  inputType,
  setInputType,
  text,
  setText,
  setFile,
  textId,
  fileId,
}: {
  label: string;
  inputType: "text" | "file";
  setInputType: (value: "text" | "file") => void;
  text: string;
  setText: (value: string) => void;
  setFile: (file: File | null) => void;
  textId: string;
  fileId: string;
}) {
  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      <RadioGroup value={inputType} onValueChange={(v) => setInputType(v as "text" | "file")} className="flex gap-6">
        <div className="flex items-center space-x-2"><RadioGroupItem value="text" id={textId} /><Label htmlFor={textId}>Text</Label></div>
        <div className="flex items-center space-x-2"><RadioGroupItem value="file" id={fileId} /><Label htmlFor={fileId}>CSV/TXT file</Label></div>
      </RadioGroup>
      {inputType === "text" ? (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="LLFGYPVYV, ACDEFGHIK" className="min-h-32 glass" />
      ) : (
        <div className="space-y-2"><Input type="file" accept=".csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="glass" /><p className="text-sm text-muted-foreground flex items-center gap-2"><Upload className="w-4 h-4" />CSV or TXT with peptide sequences.</p></div>
      )}
    </div>
  );
}

export default function Compare() {
  const [, setLocation] = useLocation();
  const [subjectInputType, setSubjectInputType] = useState<"text" | "file">("text");
  const [subjectText, setSubjectText] = useState("");
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [targetInputType, setTargetInputType] = useState<"text" | "file">("text");
  const [targetText, setTargetText] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (subjectInputType === "text" && !subjectText.trim()) return toast.error("Please enter subject peptide(s).");
    if (subjectInputType === "file" && !subjectFile) return toast.error("Please select a subject file.");
    if (targetInputType === "text" && !targetText.trim()) return toast.error("Please enter target peptide(s).");
    if (targetInputType === "file" && !targetFile) return toast.error("Please select a target file.");

    setIsSubmitting(true);
    try {
      const formData = buildCompareFormData({ subjectInputType, subjectText, subjectFile, targetInputType, targetText, targetFile });
      const jobId = await submitCrossDomeJob(formData);
      toast.success("Comparison submitted successfully.");
      setLocation(`/results/${jobId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error submitting comparison.");
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
            <Badge variant="outline" className="border-primary/30 text-primary">Peptide-to-peptide workflow</Badge>
            <h2 className="text-3xl font-bold">Compare peptides</h2>
            <p className="text-muted-foreground">Compare two peptides, one peptide against a list, or two peptide lists. This workflow does not use species, allele, or expression data.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <PeptideInput label="Subject peptides" inputType={subjectInputType} setInputType={setSubjectInputType} text={subjectText} setText={setSubjectText} setFile={setSubjectFile} textId="compare-subject-text" fileId="compare-subject-file" />
            <PeptideInput label="Target peptides" inputType={targetInputType} setInputType={setTargetInputType} text={targetText} setText={setTargetText} setFile={setTargetFile} textId="compare-target-text" fileId="compare-target-file" />
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start comparison
            </Button>
          </form>
        </Card>
      </main>
    </PageShell>
  );
}
