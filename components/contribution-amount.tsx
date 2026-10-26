"use client";

import type { Ref } from "react";
import { validFareDraft } from "@/lib/fare";

export default function ContributionAmount({ fare, setFare, inputRef, label = "You receive" }: {
  fare: string;
  setFare: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
}) {
  return <label className="field">
    {label}
    <input ref={inputRef} required type="text" inputMode="decimal" maxLength={8}
      value={fare} onChange={(event) => {
        if (validFareDraft(event.target.value)) {
          event.target.setCustomValidity("");
          setFare(event.target.value);
        }
      }} />
  </label>;
}
