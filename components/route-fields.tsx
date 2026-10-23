"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Pin } from "@/lib/client-types";
import { cocowheelsApi, apiErrorMessage } from "@/lib/api-client";
import { SEARCH_MAX_LENGTH, searchInputError } from "@/lib/input-validation";
import { searchLocation, rememberSearchLocation } from "@/lib/search-location";
import RideFieldLabel from "./ride-field-label";
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
  const [swapped, setSwapped] = useState<{ revision: number; origin: string; destination: string } | null>(null);
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
        key={`origin-${swapped?.revision ?? 0}`}
        placeholder="Where from?"
        allowCurrentLocation
        onSwap={() => {
          const inputs = container.current?.querySelectorAll("input");
          const from = inputs?.[0]?.value ?? "";
          const to = inputs?.[1]?.value ?? "";
          if (!from && !to) return;
          setOrigin(destination);
          setDestination(origin);
          onDraftText?.("origin", to);
          onDraftText?.("destination", from);
          setSwapped((old) => ({ revision: (old?.revision ?? 0) + 1, origin: to, destination: from }));
          requestAnimationFrame(() => {
            const buttons = container.current?.querySelectorAll<HTMLButtonElement>(".route-swap");
            Array.from(buttons ?? []).find((button) => button.getClientRects().length)?.focus({ preventScroll: true });
          });
        }}
        initialValue={swapped?.origin ?? draftText?.origin ?? (origin ? locationText(origin) : "")}
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
        key={`destination-${swapped?.revision ?? 0}`}
        placeholder="Where to?"
        initialValue={
          swapped?.destination ?? draftText?.destination ??
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
  onEdit,
  allowCurrentLocation = false,
  onSwap,
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
  onEdit?: (text: string) => void;
  allowCurrentLocation?: boolean;
  onSwap?: () => void;
}) {
  const [text, setText] = useState(initialValue);
  const [places, setPlaces] = useState<Pin[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchGeneration = useRef(0);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    if (!resultsOpen) return;
    const dismiss = () => {
      ++searchGeneration.current;
      setResultsOpen(false);
      setPlaces([]);
    };
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !rootRef.current?.contains(target) && !resultsRef.current?.contains(target)) dismiss();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismiss();
      inputRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [resultsOpen]);
  useLayoutEffect(() => {
    if (!resultsOpen || !places.length) return;
    const position = () => {
      const anchor = anchorRef.current;
      const panel = resultsRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const below = bottom - rect.bottom - 12;
      const above = rect.top - top - 12;
      const upwards = below < 132 && above > below;
      const height = Math.max(0, Math.min(420, upwards ? above : below));
      panel.style.left = `${rect.left}px`;
      panel.style.width = `${rect.width}px`;
      panel.style.maxHeight = `${height}px`;
      panel.style.top = `${upwards ? rect.top - 5 - Math.min(panel.scrollHeight, height) : rect.bottom + 5}px`;
      panel.style.visibility = height < 44 || rect.bottom < top || rect.top > bottom ? "hidden" : "visible";
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [resultsOpen, places]);
  const locateOrigin = async () => {
    const generation = ++searchGeneration.current;
    setLocating(true);
    setResultsOpen(false);
    setSearchError(null);
    setPlaces([]);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("GPS"));
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("GPS")), {
          enableHighAccuracy: true, maximumAge: 0, timeout: 12000,
        });
      });
      if (generation !== searchGeneration.current) return;
      const pin = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const result = await cocowheelsApi<{ label: string | null; countryCode: string | null }>("/api/place-label", {
        method: "POST", body: JSON.stringify({ pin }),
      });
      if (generation !== searchGeneration.current) return;
      const place: Pin = { ...pin, ...(result.label ? { label: result.label } : {}),
        ...(result.countryCode ? { countryCode: result.countryCode } : {}) };
      rememberSearchLocation(place);
      setText(locationText(place));
      inputRef.current?.setCustomValidity("");
      choose(place);
    } catch (reason) {
      if (generation !== searchGeneration.current) return;
      setSearchError(reason instanceof Error && reason.message === "GPS"
        ? "We couldn’t get your location. Allow location access or search for your address."
        : apiErrorMessage(reason, "We couldn’t find your address. Please try again or search."));
    } finally {
      if (generation === searchGeneration.current) setLocating(false);
    }
  };
  const locationButton = (className: string) => allowCurrentLocation ? (
    <div className={`route-location-actions ${className}`}>
    <button type="button" className="secondary route-use-location"
      disabled={locating} onClick={() => void locateOrigin()}>
      <RideFieldLabel icon="from">{locating ? "Locating…" : "Use my location"}</RideFieldLabel>
    </button>
    {onSwap && <button type="button" className="secondary route-swap"
      aria-label="Swap addresses" title="Swap addresses" onClick={onSwap}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 20V4m-4 4 4-4 4 4M16 4v16m-4-4 4 4 4-4" />
      </svg>
    </button>}
    </div>
  ) : null;
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
    setLocating(false);
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
    setPlaces([]);
    setSearchError(null);
    setResultsOpen(true);
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
        setResultsOpen(false);
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
      ref={rootRef} className="place-search"
    >
      <div ref={anchorRef} className="place-search-input">
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
            setLocating(false);
            onEdit?.(event.target.value);
            event.target.setCustomValidity("");
            setText(event.target.value);
            setPlaces([]);
            setResultsOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && resultsOpen && places.length) {
              event.preventDefault();
              resultsRef.current?.querySelector("button")?.focus();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
        />
        {locationButton("route-location-desktop")}
        <button type="button" onClick={search}>
          Search
        </button>
      </div>
      {locationButton("route-location-mobile")}
      {searchError ? (
        <p className="reconnect" role="alert">
          {searchError}
        </p>
      ) : null}
      {resultsOpen && places.length ? createPortal(
        <div
          ref={resultsRef}
          className="place-results"
          role="region"
          aria-label="Destination search results"
          onKeyDown={(event) => {
            const buttons = Array.from(resultsRef.current?.querySelectorAll("button") ?? []);
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = { ArrowDown: Math.min(current + 1, buttons.length - 1), ArrowUp: Math.max(current - 1, 0), Home: 0, End: buttons.length - 1 }[event.key];
            if (next !== undefined) { event.preventDefault(); buttons[next]?.focus(); }
          }}
        >
          {places.map((place) => (
            <button
              type="button"
              key={`${place.latitude}:${place.longitude}`}
              onClick={() => {
                ++searchGeneration.current;
                setLocating(false);
                rememberSearchLocation(place);
                choose(place);
                setText(place.label ?? "");
                setPlaces([]);
                setResultsOpen(false);
              }}
            >
              {place.label ??
                `${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}
            </button>
          ))}
        </div>, document.body
      ) : null}
    </div>
  );
}
