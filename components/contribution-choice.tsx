"use client";
import type { ReactNode } from "react";
import { fareLabel, validFare } from "@/lib/fare";

/** Disclosure is presentation only; the checkbox explicitly changes payment mode. */
export default function ContributionChoice({
  checked,
  onChange,
  fare,
  children,
  controls,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  fare: string;
  children: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <details className="contribution-choice">
      <summary>
        Fare ·{" "}
        {checked
          ? Number(fare) > 0 && validFare(Number(fare))
            ? fareLabel(Number(fare))
            : "Contribution"
          : "Free"}
      </summary>
      <div className="contribution-body">
        <label className="usual-alert-choice">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          Ask for a contribution
        </label>
        {checked ? children : null}
        {controls}
      </div>
    </details>
  );
}
