import type React from "react";
import { useLocation } from "wouter";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Replace these with the exact filenames in your public folder.
const CROSSDOME_LOGO_SRC = "/CrossDome2-logo.gif";
const UH_LOGO_SRC = "/uh-logo.png";
const LAB_LOGO_SRC = "/antunes-lab-logo.gif";


export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative overflow-hidden">
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

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CrossDomeLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <img
      src={CROSSDOME_LOGO_SRC}
      alt="CrossDome 2.0 logo"
      className={className}
    />
  );
}

export function Header({ right }: { right?: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <header className="container py-6 border-b border-white/10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 flex items-center justify-center shrink-0">
            <CrossDomeLogo className="w-full h-full object-contain" />
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              CrossDome 2.0
            </h1>
            <p className="text-base md:text-lg text-slate-300">
              T-cell cross-reactivity analysis
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <img
            src={UH_LOGO_SRC}
            alt="University of Houston logo"
            className="h-14 w-auto object-contain"
          />

          <div className="hidden sm:block h-14 w-px bg-white/25" />

          <img
            src={LAB_LOGO_SRC}
            alt="Antunes Lab logo"
            className="h-14 w-auto object-contain"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="glass border-white/15 text-white hover:bg-white/10"
            onClick={() => setLocation("/faq")}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            FAQ
          </Button>

          {right}
        </div>
      </div>
    </header>
  );
}