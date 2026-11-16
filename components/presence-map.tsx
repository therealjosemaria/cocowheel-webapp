"use client";
import JourneyMap from "./journey-map";
import type { HomePresenceLayerProps } from "./home-presence-layer";

/** Home uses the same map renderer, with its public-presence constraints. */
export default function PresenceMap(props: HomePresenceLayerProps) {
  return <JourneyMap homePresence={props} />;
}
