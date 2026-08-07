/* Design: Glassmorphism*/

import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Upload, FlaskConical, Dna, ArrowRight } from "lucide-react";

const HLA_ALLELES = ["HLA-C*12:02", "HLA-B*57:01", "HLA-C*03:04", "HLA-A*01:01", "HLA-A*66:01", "HLA-B*15:01", "HLA-B*46:01", "HLA-A*24:02", "HLA-B*35:01", "HLA-A*29:02", "HLA-C*16:01", "HLA-B*07:02", "HLA-A*02:04", "HLA-A*02:01", "HLA-C*17:01", "HLA-A*03:01", "HLA-A*11:01", "HLA-B*15:02", "HLA-C*08:01", "HLA-A*26:08", "HLA-A*32:01", "HLA-A*68:01", "HLA-B*15:03", "HLA-B*35:03", "HLA-B*44:02", "HLA-B*51:01", "HLA-C*03:03", "HLA-C*04:01", "HLA-C*05:01", "HLA-C*07:04", "HLA-B*53:01", "HLA-C*01:02", "HLA-A*31:01", "HLA-B*48:01", "HLA-C*14:02", "HLA-A*30:02", "HLA-C*12:03", "HLA-C*02:02", "HLA-A*25:01", "HLA-A*68:02", "HLA-B*18:01", "HLA-B*41:01", "HLA-A*02:03", "HLA-C*15:02", "HLA-B*49:01", "HLA-C*07:01", "HLA-C*07:02", "HLA-C*08:02", "HLA-B*58:01", "HLA-B*14:02", "HLA-A*02:02", "HLA-A*02:06", "HLA-B*40:01", "HLA-A*30:01", "HLA-B*13:02", "HLA-B*35:08", "HLA-C*06:02", "HLA-B*27:05", "HLA-A*02:05", "HLA-B*40:02", "HLA-B*44:03", "HLA-A*26:01", "HLA-B*08:01", "HLA-B*39:01", "HLA-A*34:01", "HLA-B*51:08", "HLA-B*45:01", "HLA-B*07:06", "HLA-C*15:05", "HLA-C*03:02", "HLA-A*23:01", "HLA-A*69:01", "HLA-B*37:01", "HLA-B*50:01", "HLA-B*57:03"];

export default function Home() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"analyze" | "compare">("analyze");
  const [subjectInputType, setSubjectInputType] = useState<"text" | "file">("text");
  const [subjectText, setSubjectText] = useState("");
  const [subjectFile, setSubjectFile] = useState<File | null>(null);
  const [targetInputType, setTargetInputType] = useState<"text" | "file">("text");
  const [targetText, setTargetText] = useState("");
  const [targetFile, setTargetFile] = useState<File | null>(null);
  const [selectedHLA, setSelectedHLA] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (subjectInputType === "text" && !subjectText.trim()) {
      toast.error("Inform peptides on Subject");
      return;
    }
    if (subjectInputType === "file" && !subjectFile) {
      toast.error("Select a file on Subject");
      return;
    }
    
    if (mode === "analyze" && !selectedHLA) {
      toast.error("Select your HLA(s) of interest");
      return;
    }
    
    if (mode === "compare") {
      if (targetInputType === "text" && !targetText.trim()) {
        toast.error("Inform your peptide on Target");
        return;
      }
      if (targetInputType === "file" && !targetFile) {
        toast.error("Select a file on Target");
        return;
      }
    }

    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("subjectInputType", subjectInputType);
      
      if (subjectInputType === "text") {
        formData.append("subjectText", subjectText);
      } else if (subjectFile) {
        formData.append("subjectFile", subjectFile);
      }
      
      if (mode === "analyze") {
        formData.append("targetHLA", selectedHLA);
      } else {
        formData.append("targetInputType", targetInputType);
        if (targetInputType === "text") {
          formData.append("targetText", targetText);
        } else if (targetFile) {
          formData.append("targetFile", targetFile);
        }
      }

      // Replace with your actual backend URL
      const response = await fetch("http://localhost:5000/api/v1/submitform", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.status === "ok") {
        toast.success("Submited!");
        // Navigate to results page
        setLocation(`/results/${data.job_id}`);
      } else {
        toast.error(data.message || "Submission Error");
      }
    } catch (error) {
      console.error("Form submission ERROR:", error);
      toast.error("Server connetion ERROR");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background with gradient and noise */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, oklch(0.25 0.08 270) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, oklch(0.2 0.06 250) 0%, transparent 50%),
            oklch(0.15 0.04 250)
          `,
        }}
      >
        <div className="noise-texture absolute inset-0" />
      </div>

      {/* Hero background image */}
      <div 
        className="fixed inset-0 z-0 opacity-30"
        style={{
          backgroundImage: `url('./figures/ijBs1ISCiZdfaGxPIBcCRP-img-1_1770970884000_na1fn_aGVyby1iYWNrZ3JvdW5k.webp')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="container py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 backdrop-blur-xl flex items-center justify-center border border-primary/30">
                <Dna className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">CrossDome</h1>
                <p className="text-sm text-muted-foreground">Peptide Cross-Reactivity Analysis</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Antunes Lab - UH</p>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container py-16">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Análise Avançada de<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary">
                Cross-Reatividade
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Predição de riscos de cross-reatividade de peptídeos usando algoritmos de machine learning e análise bioinformática de ponta.
            </p>
          </div>
        </section>

        {/* Analysis Form */}
        <section className="container pb-24">
          <Card className="max-w-5xl mx-auto glass border-white/10 shadow-2xl shadow-primary/5">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Mode Selection */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Modo de Análise</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as "analyze" | "compare")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 glass">
                    <TabsTrigger value="analyze" className="data-[state=active]:bg-primary/20">
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Analyze
                    </TabsTrigger>
                    <TabsTrigger value="compare" className="data-[state=active]:bg-primary/20">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Compare
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-sm text-muted-foreground">
                  {mode === "analyze" 
                    ? "Analize peptide against an specific HLA allele." 
                    : "Compare specific pairs of peptides."}
                </p>
              </div>

              {/* Subject Input */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Subject Peptides</Label>
                <RadioGroup value={subjectInputType} onValueChange={(v) => setSubjectInputType(v as "text" | "file")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="subject-text" />
                    <Label htmlFor="subject-text" className="font-normal cursor-pointer">Texto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="subject-file" />
                    <Label htmlFor="subject-file" className="font-normal cursor-pointer">Arquivo (.csv ou .txt)</Label>
                  </div>
                </RadioGroup>

                {subjectInputType === "text" ? (
                  <Textarea
                    placeholder="Inform your peptides separated by comma (ex: LLFGYPVYV, ACDEFGHIK)."
                    value={subjectText}
                    onChange={(e) => setSubjectText(e.target.value)}
                    className="min-h-32 glass border-white/10 font-mono text-sm"
                  />
                ) : (
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setSubjectFile(e.target.files?.[0] || null)}
                      className="glass border-white/10"
                    />
                    {subjectFile && (
                      <p className="mt-2 text-sm text-primary flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {subjectFile.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Target Input */}
              {mode === "analyze" ? (
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Target HLA Allele</Label>
                  <Select value={selectedHLA} onValueChange={setSelectedHLA}>
                    <SelectTrigger className="glass border-white/10">
                      <SelectValue placeholder="Selecione um alelo HLA" />
                    </SelectTrigger>
                    <SelectContent className="glass border-white/10 backdrop-blur-xl max-h-64">
                      {HLA_ALLELES.map((allele) => (
                        <SelectItem key={allele} value={allele} className="font-mono text-sm">
                          {allele}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Target Peptides</Label>
                  <RadioGroup value={targetInputType} onValueChange={(v) => setTargetInputType(v as "text" | "file")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="text" id="target-text" />
                      <Label htmlFor="target-text" className="font-normal cursor-pointer">Texto</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="target-file" />
                      <Label htmlFor="target-file" className="font-normal cursor-pointer">Arquivo (.csv ou .txt)</Label>
                    </div>
                  </RadioGroup>

                  {targetInputType === "text" ? (
                    <Textarea
                      placeholder="Inform your peptides separated by comma"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                      className="min-h-32 glass border-white/10 font-mono text-sm"
                    />
                  ) : (
                    <div className="relative">
                      <Input
                        type="file"
                        accept=".csv,.txt"
                        onChange={(e) => setTargetFile(e.target.files?.[0] || null)}
                        className="glass border-white/10"
                      />
                      {targetFile && (
                        <p className="mt-2 text-sm text-primary flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          {targetFile.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FlaskConical className="w-5 h-5 mr-2" />
                    Iniciar Análise
                  </>
                )}
              </Button>
            </form>
          </Card>
        </section>

        {/* Features Section */}
        <section className="container pb-24">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="glass border-white/10 p-6 space-y-4 hover:border-primary/30 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <FlaskConical className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Placeholder: Analize precisa</h3>
              <p className="text-muted-foreground">
                # Placeholder: Algoritmos de para predição confiável de cross-reatividade
              </p>
            </Card>

            <Card className="glass border-white/10 p-6 space-y-4 hover:border-accent/30 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                <Dna className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">Placeholder: Base de Dados Extensa</h3>
              <p className="text-muted-foreground">
                Placeholder: Acesso a bancos de dados completos de HLA e peptídeos
              </p>
            </Card>

            <Card className="glass border-white/10 p-6 space-y-4 hover:border-primary/30 transition-all hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Placeholder: Resultados Rápidos</h3>
              <p className="text-muted-foreground">
                Placeholder: Processamento eficiente com visualização clara dos resultados
              </p>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="container py-8 border-t border-white/10">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2026 CrossDome - Antunes Lab - University of Houston</p>
            <p className="mt-2">Python reimplementation of the CrossDome R package</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
