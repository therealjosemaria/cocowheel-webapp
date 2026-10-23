"use client";
import { useEffect, useRef, useState } from "react";
import { apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import { emptyVehicle, PLATE_ERROR, validPlate, type Vehicle } from "@/lib/vehicle";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import RideFieldLabel from "./ride-field-label";

function PlateField({
  value,
  change,
  required = false,
  disabled = false,
}: {
  value: string;
  change: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const invalid = value.length > 0 && !validPlate(value);
  useEffect(() => {
    input.current?.setCustomValidity(invalid ? PLATE_ERROR : "");
  }, [invalid]);
  return (
    <label className="field">
      Number plate (required)
      <input
        ref={input}
        value={value}
        onChange={(e) => change(e.target.value.toUpperCase())}
        placeholder="ABC123"
        aria-invalid={invalid || undefined}
        autoCapitalize="characters"
        autoComplete="off"
        required={required}
        disabled={disabled}
      />
    </label>
  );
}

export default function VehicleDetails() {
  const [vehicle, setVehicle] = useState<Vehicle>(emptyVehicle);
  const [loaded, setLoaded] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    cocowheelsApi<{ vehicle: Vehicle | null }>("/api/vehicle")
      .then((result) => {
        if (active) {
          setVehicle(result.vehicle ?? emptyVehicle);
          setLoaded(true);
          setError(null);
        }
      })
      .catch((reason) => {
        if (active) setError(apiErrorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [reload]);
  function change(key: keyof Vehicle, value: string) {
    setVehicle((old) => ({ ...old, [key]: value }));
    setSaved(false);
  }
  return (
    <details className="contribution-choice profile-disclosure vehicle-details">
      <summary>
        <RideFieldLabel icon="driver">Vehicle details (drivers only)</RideFieldLabel>
      </summary>
      <form
        className="vehicle-fields"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !loaded) return;
          setBusy(true);
          setError(null);
          setSaved(false);
          try {
            const result = await cocowheelsApi<{ vehicle: Vehicle }>(
              "/api/vehicle",
              { method: "POST", body: JSON.stringify(vehicle) },
            );
            setVehicle(result.vehicle);
            setSaved(true);
          } catch (reason) {
            setError(
              apiErrorMessage(
                reason,
                "Check your vehicle details and try again.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <p role="alert">{error}</p>}
        {!loaded ? (
          error ? (
            <button
              type="button"
              className="secondary"
              onClick={() => setReload((x) => x + 1)}
            >
              Try again
            </button>
          ) : (
            <p>Loading…</p>
          )
        ) : (
          <>
            <PlateField
              value={vehicle.plate}
              change={(value) => change("plate", value)}
              required
              disabled={busy}
            />
            {(
              [
                ["make", "Make", "Toyota"],
                ["model", "Model", "Corolla"],
                ["colour", "Colour", "White"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label className="field" key={key}>
                {label}
                <input
                  value={vehicle[key]}
                  placeholder={placeholder}
                  maxLength={40}
                  disabled={busy}
                  onChange={(e) => change(key, e.target.value)}
                />
              </label>
            ))}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save vehicle details"}
            </button>
            {saved && <p role="status">Vehicle details saved.</p>}
          </>
        )}
      </form>
    </details>
  );
}

export function VehiclePlatePrompt({
  close,
  confirm,
}: {
  close: () => void;
  confirm: (plate: string) => Promise<void>;
}) {
  const ref = useRef<HTMLElement>(null);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDialogFocus(ref, close, busy);
  return (
    <div className="cancel-prompt-backdrop">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Add your number plate"
        className="cancel-prompt"
      >
        <form
          className="vehicle-fields"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy || !plate.trim()) return;
            setBusy(true);
            setError(null);
            try {
              await confirm(plate);
            } catch (reason) {
              setError(
                apiErrorMessage(
                  reason,
                  "We couldn’t accept this rider. Please try again.",
                ),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Add your number plate so your rider can recognise your car.</p>
          <PlateField
            value={plate}
            change={setPlate}
            required
            disabled={busy}
          />
          {error && <p role="alert">{error}</p>}
          <div className="cancel-prompt-actions">
            <button className="primary" disabled={busy || !plate.trim()}>
              {busy ? "Saving…" : "Save & accept"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              Go back
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function RideVehicle({ vehicle }: { vehicle?: Vehicle }) {
  if (!vehicle?.plate) return null;
  return (
    <section className="ride-vehicle" aria-label="Vehicle details">
      <RideFieldLabel icon="driver">Vehicle</RideFieldLabel>
      <p>{vehicle.plate}</p>
      {[vehicle.colour, vehicle.make, vehicle.model].filter(Boolean).length >
        0 && (
        <p>
          {[vehicle.colour, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </section>
  );
}
