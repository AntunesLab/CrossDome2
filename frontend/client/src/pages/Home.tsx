import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Database, FlaskConical, GitCompareArrows, Search } from "lucide-react";
import { Header, PageShell } from "./shared";



export default function Home() {
  const [, setLocation] = useLocation();

  return (
    <PageShell>
      <Header />
      <main className="container pb-24 pt-8">
        <section className="max-w-5xl mx-auto mb-14 text-center">
          <div className="space-y-8 flex flex-col items-center">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
              CrossDome 2.0
            </h2>
            <p className="text-xl text-slate-300 max-w-4xl">
              Off-target toxicity prediction and cross-reactivity analysis. 
              
              CrossDome 2.0 supports T-cell-based immunotherapy safety analysis by identifying peptide sequences with
              potential cross-reactivity against human and species-specific immunopeptidomics databases.
            </p>
          </div>

        </section>

        <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="glass border-white/10 p-6 space-y-5 bg-white/[0.04]">
            <div className="w-12 h-12 rounded-xl bg-[#1f75bb]/20 flex items-center justify-center border border-[#1f75bb]/40">
              <Search className="w-6 h-6 text-[#58a9ee]" />
            </div>
            <h3 className="text-3xl font-semibold text-white">Off-target toxicity</h3>
            <p className="text-slate-300 mt-2">
              Search a database of human immunopeptidomics for potential cross-reactive targets.
              Potential off-targets are further annotated with tissue expression data and
              immunoinformatics predictions when available.
            </p>
            <Button className="w-full bg-[#1f75bb] hover:bg-[#17619d] text-white" onClick={() => setLocation("/human")}>
              Start human analysis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>

          <Card className="glass border-white/10 p-6 space-y-5 bg-white/[0.04]">
            <div className="w-12 h-12 rounded-xl bg-[#219653]/20 flex items-center justify-center border border-[#219653]/40">
              <FlaskConical className="w-6 h-6 text-[#35c275]" />
            </div>
            <h3 className="text-3xl font-semibold text-white">Other species</h3>
            <p className="text-slate-300 mt-2">
              Search non-human immunopeptidomics databases for potential cross-reactive targets,
              including murine, bovine, porcine, chicken, rat, canine, and humanized cells.
            </p>
            <Button className="w-full bg-[#219653] hover:bg-[#197a43] text-white" onClick={() => setLocation("/species")}>
              Start species analysis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>

          <Card className="glass border-white/10 p-6 space-y-5 bg-white/[0.04]">
            <div className="w-12 h-12 rounded-xl bg-[#c9252d]/20 flex items-center justify-center border border-[#c9252d]/40">
              <GitCompareArrows className="w-6 h-6 text-[#ff636a]" />
            </div>
            <h3 className="text-3xl font-semibold text-white">Compare peptides</h3>
            <p className="text-slate-300 mt-2">
              Calculate the Relatedness Score (RdS) between two peptide sequences of interest to
              measure their biochemical similarity without a species background or expression analysis.
            </p>
            <Button className="w-full bg-[#c9252d] hover:bg-[#a91d24] text-white" onClick={() => setLocation("/compare")}>
              Start comparison <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto mt-10">
          <Card className="glass border-white/10 p-5 bg-[#071c35]/60">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <Database className="w-5 h-5 text-[#58a9ee]" />
              <p className="text-slate-300 text-sm">
                Use the three entry points above depending on your analysis goal: human off-target
                screening, species-specific peptide/MHC background search, or direct peptide-to-peptide RdS comparison.
              </p>
            </div>
          </Card>
        </section>
      </main>
    </PageShell>
  );
}