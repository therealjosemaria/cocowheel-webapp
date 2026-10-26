import type { ActiveRide } from "../components/active-ride-link";
import type { DemandActivity } from "./rider-demand";
import { conversationTarget } from "./messaging-types";
import { rideUpdates, type RideUpdate } from "./ride-updates";

export type JourneyUpdate = { id: string; href: string };
export const rideJourneyKey = (id: string) => `ride:${id}`;
export const demandJourneyKey = (id: string) => `demand:${id}`;
export const offerTarget = (id: string) => `offer-${encodeURIComponent(id)}`;

export function journeyUpdates(currents: ActiveRide[], demands: DemandActivity | null, seen: string[]) {
  const groups = new Map<string, JourneyUpdate>();
  const notices: RideUpdate[] = [];
  for (const item of currents) {
    const { ride, role } = item;
    const unread = rideUpdates(item).filter(update => !seen.includes(update.key));
    notices.push(...unread);
    const message = ride.conversations?.find(thread => thread.unread > 0);
    const target = unread[0]?.target ?? (message ? conversationTarget(message.requestId) : null);
    if (!target) continue;
    const id = rideJourneyKey(ride.rideId);
    const query = role === "RIDER" && ride.request ? `?request=${encodeURIComponent(ride.request.requestId)}` : "";
    groups.set(id, { id, href: `/activity/${encodeURIComponent(ride.rideId)}${query}#${target}` });
  }
  for (const request of demands?.requests ?? []) {
    // Fulfilment is a consequence of pairing, not a second unread journey.
    if (request.status !== "OPEN") continue;
    for (const offer of request.offers) {
      const key = `demand-offer:${offer.id}`;
      if (offer.status !== "PENDING" || seen.includes(key)) continue;
      const target = offerTarget(offer.id);
      notices.push({ key, target, rideId: offer.rideId, driver: false, message: "New driver offer" });
      const id = demandJourneyKey(request.id);
      if (!groups.has(id)) groups.set(id, { id, href: `/activity/requests/${encodeURIComponent(request.id)}#${target}` });
    }
  }
  return { groups: [...groups.values()], notices };
}

export function journeyUpdatesHref(groups: JourneyUpdate[]) {
  return groups.length === 1 ? groups[0].href : groups.length ? "/activity#updates" : "/activity";
}
