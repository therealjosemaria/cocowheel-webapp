"use client";

export default function DepartureChoice({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset className="payid-field" aria-label="Leaving">
      <div
        className="payid-type-options"
        role="radiogroup"
        aria-label="Leaving"
      >
        {[0, 30, 60].map((minutes) => (
          <button
            type="button"
            key={minutes}
            role="radio"
            aria-checked={value === minutes}
            className={value === minutes ? "active" : undefined}
            onClick={() => onChange(minutes)}
          >
            {minutes === 0 ? "Now" : minutes === 30 ? "In 30 min" : "In 1 hour"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
