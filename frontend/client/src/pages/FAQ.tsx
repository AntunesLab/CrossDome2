import { useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  HelpCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header, PageShell } from "./shared";

const workflowSteps = [
  {
    title: "Enter query peptide(s)",
    description:
      "Paste one or more peptide sequences or upload a CSV/TXT file. CrossDome 2.0 accepts standard amino-acid sequences from 8 to 25 residues.",
  },
  {
    title: "Choose the analysis settings",
    description:
      "For database searches, select the species, MHC class, and available HLA/MHC allele. Direct peptide comparison does not require a species or allele.",
  },
  {
    title: "Compare peptides of the same length",
    description:
      "Each query is compared only with background peptides of the same length. For example, an 8-mer is compared with 8-mers and a 15-mer with 15-mers.",
  },
  {
    title: "Calculate and rank RdS",
    description:
      "CrossDome calculates the Relatedness Score (RdS) from amino-acid physicochemical similarity. Lower RdS values indicate more similar peptide pairs.",
  },
  {
    title: "Review and download results",
    description:
      "The results page displays the top 30 candidates. The complete ranked table can be downloaded as a CSV file. Human analyses may also include expression and prediction outputs.",
  },
];

const frequentlyAskedQuestions = [
  {
    question: "Which analysis should I select?",
    answer:
      "Use Human analysis to screen a peptide against human immunopeptidomics data and obtain human-specific annotations when available. Use Other species for mouse, rat, swine, bovine, chicken, canine, or humanized backgrounds. Use Compare peptides to calculate RdS directly between peptide sequences without a database background.",
  },
  {
    question: "What peptide lengths are supported?",
    answer:
      "CrossDome 2.0 supports peptides from 8 to 25 amino acids. Only peptides with the same length are compared.",
  },
  {
    question: "How should I format peptide input?",
    answer:
      "Use one-letter amino-acid codes and standard residues only: A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, and Y. Text entries may be separated by commas or line breaks. CSV and TXT files are also accepted.",
  },
  {
    question: "How do I interpret RdS?",
    answer:
      "RdS measures peptide relatedness based on amino-acid physicochemical properties. Lower values represent greater similarity to the query peptide and therefore higher priority for review. RdS is a screening metric and does not by itself demonstrate experimental T-cell cross-reactivity.",
  },
  {
    question: "Why are expression plots available only for human analyses?",
    answer:
      "The current expression annotation database is human-specific. Non-human analyses return ranked peptide results without human tissue-expression plots.",
  },
  {
    question: "Why are some prediction values missing?",
    answer:
      "Binding and immunogenicity scores are displayed only when prediction data are available for the peptide and selected allele. Missing values do not prevent RdS calculation or ranking.",
  },
  {
    question: "Can CrossDome results be treated as proof of cross-reactivity?",
    answer:
      "No. CrossDome prioritizes peptide candidates for follow-up. Candidate off-targets should be evaluated with supporting biological evidence and experimental validation before therapeutic decisions are made.",
  },
];

export default function FAQ() {
  const [, setLocation] = useLocation();

  return (
    <PageShell>
      <Header
        right={
          <Button variant="ghost" className="glass" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Home
          </Button>
        }
      />

      <main className="container pb-24 pt-4">
        <section className="mx-auto mb-10 max-w-4xl text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1f75bb]/40 bg-[#1f75bb]/20">
              <HelpCircle className="h-7 w-7 text-[#58a9ee]" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white md:text-5xl">CrossDome 2.0 FAQ</h2>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-300">
            General guidance for selecting an analysis, preparing peptide input, interpreting results,
            and citing CrossDome.
          </p>
        </section>

        <section className="mx-auto mb-10 max-w-6xl">
          <Card className="glass border-white/10 bg-white/[0.04] p-6 md:p-8">
            <div className="mb-7 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#219653]/40 bg-[#219653]/20">
                <CheckCircle2 className="h-6 w-6 text-[#35c275]" />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-white">How the workflow works</h3>
                <p className="mt-2 text-slate-300">
                  CrossDome compares query peptides with the selected peptide/MHC background, calculates
                  RdS, and ranks candidate off-targets for review.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative min-h-52 rounded-2xl border border-white/10 bg-[#071c35]/70 p-4"
                >
                  <div className="mb-3 text-sm font-bold text-[#58a9ee]">Step {index + 1}</div>
                  <h4 className="mb-2 font-semibold text-white">{step.title}</h4>
                  <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
                  {index < workflowSteps.length - 1 && (
                    <ArrowRight className="absolute -right-5 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-[#1f75bb] md:block" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          {frequentlyAskedQuestions.map((item) => (
            <Card key={item.question} className="glass border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start gap-3">
                <Info className="mt-1 h-5 w-5 shrink-0 text-[#58a9ee]" />
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.question}</h3>
                  <p className="mt-3 leading-relaxed text-slate-300">{item.answer}</p>
                </div>
              </div>
            </Card>
          ))}
        </section>

        <section className="mx-auto mt-10 max-w-6xl">
          <Card className="glass border-white/10 bg-[#071c35]/70 p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#c9252d]/40 bg-[#c9252d]/20">
                <BookOpen className="h-6 w-6 text-[#ff636a]" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-white">How to cite CrossDome</h3>
                <p className="text-slate-300">Please cite the original CrossDome publication:</p>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-slate-100">
                    <strong>CrossDome: an interactive R package to predict cross-reactivity risk using immunopeptidomics databases.</strong>
                  </p>
                </div>
                <p className="flex items-start gap-2 text-sm text-slate-400">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  Add the complete author, journal, year, volume, pages, and DOI information from your preferred citation manager or the publication record.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </PageShell>
  );
}
