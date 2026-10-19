import type { ReactNode } from "react";

export default function LegalPage({
  title,
  children,
  updated,
}: {
  title: string;
  children: ReactNode;
  updated?: boolean;
}) {
  return (
    <section className="activity-page">
      <article className="activity-panel">
        <h1 className="page-title">{title}</h1>
        <div className="legal-content">
          <p className="legal-updated">
            Last updated:{" "}
            <time dateTime={updated ? "2026-10-19" : "2026-10-16"}>
              {updated ? "19 October 2026" : "16 October 2026"}
            </time>
          </p>
          {children}
        </div>
      </article>
    </section>
  );
}
