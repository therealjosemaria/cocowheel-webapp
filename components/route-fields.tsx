"use client";

import { useEffect, useRef, useState } from "react";
import type { Pin } from "@/lib/client-types";
import { cocowheelsApi, apiErrorMessage } from "@/lib/api-client";
import { SEARCH_MAX_LENGTH, searchInputError } from "@/lib/input-validation";
import { searchLocation, rememberSearchLocation } from "@/lib/search-location";
const canonicalPin = (pin: Pin) => ({
  latitude: pin.latitude,
  longitude: pin.longitude,
});
const locationText = (pin: Pin) =>
  pin.label ?? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;

export function RouteFields({
  origin,
  destination,
  setOrigin,
  setDestination,
  countryCode = "au",
  onComplete,
  draftText,
  onDraftText,
}: {
  origin?: Pin;
  destination?: Pin;
  setOrigin: (pin: Pin | undefined) => void;
  setDestination: (pin: Pin | undefined) => void;
  countryCode?: string;
  onComplete?: () => void;
  draftText?: { origin: string; destination: string };
  onDraftText?: (field: "origin" | "destination", text: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const inputs = container.current?.querySelectorAll("input");
      const empty = Array.from(inputs ?? []).find(
        (input) => !input.value.trim(),
      );
      empty?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="route-search-fields" ref={container}>
      <PlaceSearch
        placeholder="Where from?"
        initialValue={draftText?.origin ?? (origin ? locationText(origin) : "")}
        countryCode={countryCode}
        onEdit={(text) => {
          setOrigin(undefined);
          onDraftText?.("origin", text);
        }}
        choose={(pin) => {
          setOrigin(pin);
          onDraftText?.("origin", locationText(pin));
          if (destination) onComplete?.();
          else
            container.current
              ?.querySelectorAll("input")[1]
              ?.focus({ preventScroll: true });
        }}
      />
      <PlaceSearch
        placeholder="Where to?"
        initialValue={
          draftText?.destination ??
          (destination ? locationText(destination) : "")
        }
        bias={origin}
        countryCode={origin?.countryCode ?? countryCode}
        onEdit={(text) => {
          setDestination(undefined);
          onDraftText?.("destination", text);
        }}
        choose={(pin) => {
          setDestination(pin);
          onDraftText?.("destination", locationText(pin));
          if (origin) onComplete?.();
        }}
      />
    </div>
  );
}

export function PlaceSearch({
  bias,
  countryCode,
  choose,
  placeholder,
  ariaLabel,
  initialValue = "",
  autoFocus = false,
  selectOnFocus = false,
  destinationIcon = false,
  inlineResults = true,
  onEdit,
}: {
  bias?: Pin;
  countryCode?: string;
  choose: (pin: Pin) => void;
  placeholder: string;
  ariaLabel?: string;
  initialValue?: string;
  autoFocus?: boolean;
  selectOnFocus?: boolean;
  destinationIcon?: boolean;
  inlineResults?: boolean;
  onEdit?: (text: string) => void;
}) {
  const [text, setText] = useState(initialValue);
  const [places, setPlaces] = useState<Pin[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchGeneration = useRef(0);
  useEffect(
    () => () => {
      ++searchGeneration.current;
    },
    [],
  );
  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (selectOnFocus) inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, selectOnFocus]);
  const search = () => {
    const previous = searchLocation();
    const preferredLocation = bias ?? previous;
    const preferredCountry = bias?.countryCode ?? previous?.countryCode ?? countryCode;
    const generation = ++searchGeneration.current;
    inputRef.current?.setCustomValidity(searchInputError(text) ?? "");
    if (!inputRef.current?.reportValidity()) return;
    if (text.trim().length < 3) {
      inputRef.current?.focus();
      return;
    }
    void cocowheelsApi<{ places: Pin[] }>("/api/place-search", {
      method: "POST",
      body: JSON.stringify({
        text,
        ...(preferredLocation ? { bias: canonicalPin(preferredLocation) } : {}),
        ...(preferredCountry ? { countryCode: preferredCountry } : {}),
      }),
    })
      .then((result) => {
        if (generation !== searchGeneration.current) return;
        setPlaces(result.places);
        setSearchError(null);
      })
      .catch((reason) => {
        if (generation !== searchGeneration.current) return;
        setPlaces([]);
        setSearchError(
          apiErrorMessage(
            reason,
            "We couldn’t search destinations. Please try again.",
          ),
        );
      });
  };
  return (
    <div
      className={`place-search${inlineResults ? " place-search-inline-results" : ""}`}
    >
      <div className="place-search-input">
        {destinationIcon ? (
          <svg
            className="place-search-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 21s6-5.13 6-11a6 6 0 1 0-12 0c0 5.87 6 11 6 11Z" />
            <circle cx="12" cy="10" r="2" />
          </svg>
        ) : null}
        <input
          ref={inputRef}
          maxLength={SEARCH_MAX_LENGTH}
          autoFocus={autoFocus}
          value={text}
          onChange={(event) => {
            ++searchGeneration.current;
            onEdit?.(event.target.value);
            event.target.setCustomValidity("");
            setText(event.target.value);
            setPlaces([]);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
        />
        <button type="button" onClick={search}>
          Search
        </button>
      </div>
      {searchError ? (
        <p className="reconnect" role="alert">
          {searchError}
        </p>
      ) : null}
      {places.length ? (
        <div
          className="place-results"
          role="region"
          aria-label="Destination search results"
          tabIndex={0}
        >
          {places.map((place) => (
            <button
              type="button"
              key={`${place.latitude}:${place.longitude}`}
              onClick={() => {
                ++searchGeneration.current;
                rememberSearchLocation(place);
                choose(place);
                setText(place.label ?? "");
                setPlaces([]);
              }}
            >
              {place.label ??
                `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
