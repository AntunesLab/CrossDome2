import type { ReactNode } from "react";
import { Link } from "wouter";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="header container">
        <Link href="/" className="brand"><span className="logo-mark">CD</span><span><strong>CrossDome 2.1</strong><small>Peptide cross-reactivity analysis</small></span></Link>
        <span className="lab-label">Antunes Lab · UH</span>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
