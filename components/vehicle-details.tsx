"use client";
import { useEffect, useRef, useState } from "react";
import { apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import {
  emptyVehicle,
  PLATE_ERROR,
  validPlate,
  type Vehicle,
  VEHICLE_YEAR_ERROR,
} from "@/lib/vehicle";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import RideFieldLabel from "./ride-field-label";
import VehicleChoiceField from "./vehicle-choice-field";
import VehicleArtwork from "./vehicle-artwork";
import { notifyVehicleSaved } from "@/lib/vehicle-updates";
import {
  VEHICLE_MAKES,
  VEHICLE_MODELS,
  VEHICLE_COLOURS,
  vehicleYearOptions,
  validVehicleYear,
  vehicleModelLabel,
} from "@/lib/vehicle-catalogue";

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
  function change(key: "plate", value: string) {
    setVehicle((old) => ({ ...old, [key]: value }));
    setSaved(false);
  }
  function choose(
    key: "make" | "model" | "colour" | "year",
    value: string,
    selected?: string,
  ) {
    setVehicle((old) => {
      const selection = { ...old.selection };
      if (selected) selection[key] = selected;
      else delete selection[key];
      // Changing make invalidates the previous model, including its illustration.
      if (key === "make") delete selection.model;
      if (key === "make" || key === "model") delete selection.year;
      return {
        ...old,
        [key]: value,
        ...(key === "make" ? { model: "" } : {}),
        ...(key === "make" || key === "model" ? { year: "" } : {}),
        selection,
      };
    });
    setSaved(false);
  }
  return (
    <details className="contribution-choice profile-disclosure vehicle-details">
      <summary>
        <RideFieldLabel icon="driver">
          Vehicle details (drivers only)
        </RideFieldLabel>
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
            notifyVehicleSaved();
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
            <VehicleArtwork vehicle={vehicle} />
            <PlateField
              value={vehicle.plate}
              change={(value) => change("plate", value)}
              required
              disabled={busy}
            />
            <VehicleChoiceField
              label="Make"
              value={vehicle.make}
              selected={vehicle.selection?.make}
              options={VEHICLE_MAKES.map((make) => ({ id: make, label: make }))}
              busy={busy}
              change={(value, selected) => choose("make", value, selected)}
            />
            <VehicleChoiceField
              key={vehicle.selection?.make ?? vehicle.make}
              label="Model"
              value={vehicle.model}
              selected={vehicle.selection?.model}
              options={VEHICLE_MODELS.filter(
                (item) => item.make === vehicle.selection?.make,
              ).map((item) => ({
                id: item.id,
                label: vehicleModelLabel(item),
                value: item.model,
              }))}
              busy={busy}
              change={(value, selected) => choose("model", value, selected)}
            />
            <VehicleChoiceField
              key={`year-${vehicle.selection?.model ?? vehicle.model}`}
              label="Year"
              value={vehicle.year ?? ""}
              selected={vehicle.selection?.year}
              options={vehicleYearOptions(vehicle.selection?.model).map(
                (year) => ({
                  id: year,
                  label: year,
                }),
              )}
              busy={busy}
              maxLength={4}
              inputMode="numeric"
              errorMessage={
                vehicle.year?.trim() && !validVehicleYear(vehicle.year.trim())
                  ? VEHICLE_YEAR_ERROR
                  : ""
              }
              change={(value, selected) => choose("year", value, selected)}
            />
            <VehicleChoiceField
              label="Colour"
              value={vehicle.colour}
              selected={vehicle.selection?.colour}
              options={VEHICLE_COLOURS.map((colour) => ({
                id: colour,
                label: colour,
              }))}
              busy={busy}
              change={(value, selected) => choose("colour", value, selected)}
            />
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
  submitLabel = "Save & accept",
  externalError,
  externalBusy = false,
}: {
  close: () => void;
  confirm: (plate: string) => Promise<void>;
  submitLabel?: string;
  externalError?: string | null;
  externalBusy?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = busy || externalBusy;
  const [error, setError] = useState<string | null>(null);
  useDialogFocus(ref, close, pending);
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
            if (pending || !plate.trim()) return;
            setBusy(true);
            setError(null);
            try {
              await confirm(plate);
            } catch (reason) {
              setError(
                apiErrorMessage(
                  reason,
                  "We couldn’t complete that action. Please try again.",
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
            disabled={pending}
          />
          {(error || externalError) && (
            <p role="alert">{error || externalError}</p>
          )}
          <div className="cancel-prompt-actions">
            <button className="primary" disabled={pending || !plate.trim()}>
              {pending ? "Saving…" : submitLabel}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={pending}
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
      <VehicleArtwork vehicle={vehicle} />
      <RideFieldLabel icon="driver">Vehicle</RideFieldLabel>
      <p>{vehicle.plate}</p>
      {[vehicle.year, vehicle.colour, vehicle.make, vehicle.model].filter(
        Boolean,
      ).length > 0 && (
        <p>
          {[vehicle.year, vehicle.colour, vehicle.make, vehicle.model]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
    </section>
  );
}
