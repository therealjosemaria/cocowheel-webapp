import type { ReactNode } from "react";

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="activity-page">
      <article className="activity-panel">
        <h1 className="page-title">{title}</h1>
        <div className="legal-content">
          <p className="legal-updated">Last updated: <time dateTime="2026-10-16">16 October 2026</time></p>
          {children}
        </div>
      </article>
    </section>
  );
}
