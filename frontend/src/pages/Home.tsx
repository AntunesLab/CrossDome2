import { Link } from "wouter";
import Layout from "./Layout";

export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <span className="eyebrow">CrossDome 2.1</span>
        <h1>Peptide cross-reactivity analysis</h1>
        <p>Run human off-target analysis, use species-specific peptide/MHC backgrounds, or compare peptide sets directly. CrossDome uses length-specific RdS distributions for 8–25 amino acid peptides.</p>
      </section>
      <section className="card-grid three">
        <article className="card"><h2>Human analysis</h2><p>HLA-specific ranking with RdS statistics, expression heatmap, and available binding/immunogenicity predictions.</p><Link className="button" href="/human">Start human analysis</Link></article>
        <article className="card"><h2>Other species</h2><p>Species- and MHC-specific background analysis without human expression or prediction plots.</p><Link className="button" href="/species">Start species analysis</Link></article>
        <article className="card"><h2>Compare peptides</h2><p>Calculate RdS directly between two peptides or peptide lists using the same length-specific statistics.</p><Link className="button" href="/compare">Start comparison</Link></article>
      </section>
    </Layout>
  );
}
