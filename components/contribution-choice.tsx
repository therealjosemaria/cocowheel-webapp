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
  rider = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  fare: string;
  children: ReactNode;
  controls?: ReactNode;
  rider?: boolean;
}) {
  return (
    <details className="contribution-choice">
      <summary>
        {rider ? "Offered contribution" : "Fare"} ·{" "}
        {checked
          ? Number(fare) > 0 && validFare(Number(fare))
            ? fareLabel(Number(fare))
            : "Contribution"
          : rider ? "None" : "Free"}
      </summary>
      <div className="contribution-body">
        <label className="usual-alert-choice">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          {rider ? "Offer a contribution" : "Ask for a contribution"}
        </label>
        {checked ? children : null}
        {controls}
      </div>
    </details>
  );
}
