import type { ReactNode } from "react";

export function JourneyResultsLayout({ children }: { children: ReactNode }) {
  return <div className="ride-selection-page">{children}</div>;
}

export function JourneyResultsMap({ children, back }: { children: ReactNode; back: () => void }) {
  return <div className="ride-selection-map">
    {children}
    <button type="button" className="text-button ride-selection-back"
      aria-label="Back to route search" onClick={back}>Back</button>
  </div>;
}

export function JourneyResultsList({ children, label }: { children: ReactNode; label: string }) {
  return <section className="ride-options" aria-label={label} aria-live="polite">
    <div className="ride-option-list">{children}</div>
  </section>;
}
