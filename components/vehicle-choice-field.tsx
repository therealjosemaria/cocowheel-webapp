"use client";
import { useEffect, useId, useRef, useState } from "react";

/** Native dropdown plus an explicit Other input preserves selection provenance. */
export default function VehicleChoiceField({
  label,
  value,
  selected,
  options,
  busy,
  change,
  maxLength = 40,
  inputMode = "text",
  errorMessage = "",
}: {
  label: string;
  value: string;
  selected?: string;
  options: Array<{ id: string; label: string; value?: string }>;
  busy: boolean;
  change: (text: string, selection?: string) => void;
  maxLength?: number;
  inputMode?: "text" | "numeric";
  errorMessage?: string;
}) {
  const id = useId();
  const [other, setOther] = useState(Boolean(value && !selected));
  const custom = other || Boolean(value && !selected);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(errorMessage);
  }, [errorMessage, custom]);
  return (
    <div className="vehicle-choice-field">
      <label className="field" htmlFor={id}>
        {label}
        <select
          id={id}
          aria-label={label}
          value={selected ?? (custom ? "other" : "")}
          disabled={busy}
          onChange={(event) => {
            const next = event.target.value;
            setOther(next === "other");
            const option = options.find((item) => item.id === next);
            change(option?.value ?? option?.label ?? "", option?.id);
          }}
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
          <option value="other">Other</option>
        </select>
      </label>
      {custom && !selected ? (
        <input
          ref={input}
          aria-label={`Other ${label.toLowerCase()}`}
          value={value}
          placeholder={`Enter ${label.toLowerCase()}`}
          maxLength={maxLength}
          inputMode={inputMode}
          aria-invalid={Boolean(errorMessage) || undefined}
          disabled={busy}
          onChange={(event) => change(event.target.value)}
        />
      ) : null}
    </div>
  );
}
