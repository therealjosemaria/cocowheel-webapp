"use client";

export default function RouteTime({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`field usual-route-time${value ? "" : " is-empty"}`}>
      <input type="time" aria-label="Usual departure time" value={value}
        disabled={disabled} onChange={(event) => onChange(event.target.value)} />
      {!value && <span className="route-time-placeholder" aria-hidden="true">Choose a time</span>}
    </div>
  );
}
