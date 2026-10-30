import { queueNotification, reviewNotifications } from "./notification-outbox";
import { randomUUID } from "node:crypto";
import {
  checkedDemandRoute,
  checkedPostedDemand,
  checkedDemandSearch,
  demandExpiry,
  demandWindows,
  type DemandActivity,
  type DemandOffer,
  type RiderDemand,
} from "../lib/rider-demand";
import {
  currentOpenRides,
  cancelPendingRequest,
  decideRequestForDriver,
  expireStaleRides,
  findSession,
  getRide,
  publishRide,
  publishRideForDriver,
  replacePostedJourney,
  validateRideInput,
  requestRide,
  type CreateRideInput,
  type Db,
} from "./core";
import { requireUniversitySession } from "./university-auth";
import { publicName } from "./personal-details";
import { corridorMatches } from "./usual-routes";
import { readVehicle, saveVehicle, snapshotVehicle } from "./vehicles";
import { emptyVehicle } from "../lib/vehicle";
import { distanceMeters } from "../lib/location-tracking";

type Row = {
  id: string;
  owner_id: string;
  body: string;
  status: RiderDemand["status"];
  created_at: string;
  expires_at: string;
};
type OfferRow = {
  created_at: string;
  id: string;
  demand_id: string;
  ride_id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  public_id: string;
  driver_session_id: string;
  driver_alias: string;
  scheduled_departure_at: string;
  price_aud: number;
  ride_status: string;
  origin_latitude: number;
  origin_longitude: number;
  origin_label: string;
  destination_latitude: number;
  destination_longitude: number;
  destination_label: string;
};
const offerSql = `SELECT o.*, r.public_id, r.driver_session_id, r.driver_alias, r.scheduled_departure_at, r.price_aud, r.status AS ride_status,
 r.origin_latitude, r.origin_longitude, r.origin_label, r.destination_latitude, r.destination_longitude, r.destination_label
 FROM rider_demand_offers o JOIN rides r ON r.id=o.ride_id`;
type ProposalRow = {
  id: string; demand_id: string; source_ride_id: string; body: string;
  status: "PENDING" | "DECLINED" | "ACCEPTED"; created_at: string;
  public_id: string; driver_session_id: string; driver_alias: string; ride_status: string;
};
const proposalSql = `SELECT p.*, r.public_id, r.driver_session_id, r.driver_alias, r.status AS ride_status
 FROM rider_demand_proposals p JOIN rides r ON r.id=p.source_ride_id`;
function proposalView(db: Db, row: ProposalRow, now: Date): DemandOffer {
  const input = JSON.parse(row.body) as CreateRideInput;
  return {
    id: row.id, demandId: row.demand_id, rideId: "", pendingReplacement: true,
    createdAt: row.created_at,
    driverAlias: publicName(db, row.driver_session_id, row.driver_alias),
    departureAt: input.scheduledDepartureAt, priceAud: input.priceAud,
    origin: input.origin, destination: input.destination,
    status: offerWithdrawn(db, row.id) ? "WITHDRAWN" : row.status === "PENDING" &&
      (!["PUBLISHED", "REQUESTED"].includes(row.ride_status) ||
        Date.parse(input.scheduledDepartureAt) <= +now || demand(db, row.demand_id).status !== "OPEN")
      ? "UNAVAILABLE" : row.status,
  };
}
function refresh(db: Db, now: Date) {
  expireStaleRides(db, now);
  db.prepare(
    "UPDATE rider_demands SET status='EXPIRED' WHERE status='OPEN' AND expires_at<=?",
  ).run(now.toISOString());
}
function offerWithdrawn(db: Db, id: string) {
  return Boolean(db.prepare("SELECT 1 FROM rider_demand_offer_withdrawals WHERE offer_id=?").get(id));
}
function demand(db: Db, id: string) {
  const row = db.prepare("SELECT * FROM rider_demands WHERE id=?").get(id) as
    Row | undefined;
  if (!row) throw new Error("DEMAND_NOT_FOUND");
  return row;
}
function view(db: Db, row: Row): RiderDemand {
  return {
    ...JSON.parse(row.body),
    id: row.id,
    alias: publicName(db, row.owner_id, "Member"),
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}
function offerView(db: Db, row: OfferRow, now: Date): DemandOffer {
  return {
    id: row.id,
    demandId: row.demand_id,
    rideId: row.public_id,
    createdAt: row.created_at,
    driverAlias: publicName(db, row.driver_session_id, row.driver_alias),
    departureAt: row.scheduled_departure_at,
    priceAud: row.price_aud,
    origin: {
      latitude: row.origin_latitude,
      longitude: row.origin_longitude,
      label: row.origin_label,
    },
    destination: {
      latitude: row.destination_latitude,
      longitude: row.destination_longitude,
      label: row.destination_label,
    },
    status:
      offerWithdrawn(db, row.id) ? "WITHDRAWN" : row.status === "PENDING" &&
      (!["PUBLISHED", "REQUESTED"].includes(row.ride_status) ||
        Date.parse(row.scheduled_departure_at) <= +now ||
        demand(db, row.demand_id).status !== "OPEN")
        ? "UNAVAILABLE"
        : row.status,
  };
}
function busyOwner(db: Db, owner: string) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM rides WHERE driver_session_id=? AND status IN ('PUBLISHED','REQUESTED','ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE')
    UNION ALL SELECT 1 FROM ride_requests q JOIN rides r ON r.id=q.ride_id WHERE q.rider_session_id=? AND q.status='ACCEPTED' AND r.status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE') LIMIT 1`,
      )
      .get(owner, owner),
  );
}
export function postDemand(
  db: Db,
  token: string | null,
  body: unknown,
  now = new Date(),
) {
  const owner = requireUniversitySession(db, token);
  const route = checkedPostedDemand(body, now);
  const replacement = (body as Record<string, unknown>).replaceDemandId;
  if (replacement !== undefined && (typeof replacement !== "string" || !replacement)) throw new Error("INVALID_DEMAND");
  const expires = demandExpiry(route, now);
  if (Date.parse(expires) <= +now) throw new Error("INVALID_REQUEST_TIME");
  return db.transaction(() => {
    refresh(db, now);
    if (busyOwner(db, owner.id)) throw new Error("OPEN_ITEM_EXISTS");
    const existing = db
      .prepare("SELECT * FROM rider_demands WHERE owner_id=? AND status='OPEN'")
      .get(owner.id) as Row | undefined;
    if (existing) {
      if (existing.body === JSON.stringify(route)) return view(db, existing); // Retry, not renewal.
      if (replacement === undefined) throw new Error("DEMAND_ALREADY_OPEN");
      if (replacement !== existing.id) throw new Error("DEMAND_CHANGED");
      db.prepare("UPDATE rider_demands SET status='CANCELLED' WHERE id=? AND owner_id=? AND status='OPEN'").run(existing.id, owner.id);
    } else if (replacement !== undefined) {
      throw new Error("DEMAND_CHANGED");
    }
    const id = randomUUID();
    db.prepare("INSERT INTO rider_demands VALUES (?,?,?,'OPEN',?,?)").run(
      id,
      owner.id,
      JSON.stringify(route),
      now.toISOString(),
      expires,
    );
    return view(db, demand(db, id));
  })();
}
export function demandActivity(
  db: Db,
  token: string | null,
  now = new Date(),
): DemandActivity {
  const owner = requireUniversitySession(db, token);
  refresh(db, now);
  const requests = (
    db
      .prepare(
        "SELECT * FROM rider_demands WHERE owner_id=? ORDER BY created_at DESC LIMIT 50",
      )
      .all(owner.id) as Row[]
  ).map((row) => ({
    ...view(db, row),
    offers: [ ...(
      db
        .prepare(offerSql + " WHERE o.demand_id=? ORDER BY o.created_at DESC")
        .all(row.id) as OfferRow[]
    ).map((o) => offerView(db, o, now)),
    ...(db.prepare(proposalSql + " WHERE p.demand_id=? AND p.status!='ACCEPTED' ORDER BY p.created_at DESC").all(row.id) as ProposalRow[]).map(p => proposalView(db, p, now)) ],
  }));
  const sent = (
    db
      .prepare(
        offerSql +
          " WHERE r.driver_session_id=? ORDER BY o.created_at DESC LIMIT 50",
      )
      .all(owner.id) as OfferRow[]
  ).map((row) => offerView(db, row, now));
  const proposals = (db.prepare(proposalSql + " WHERE r.driver_session_id=? AND p.status!='ACCEPTED' ORDER BY p.created_at DESC LIMIT 50").all(owner.id) as ProposalRow[]).map(p => proposalView(db, p, now));
  return { requests, sent: [...proposals, ...sent] };
}
export function activeDemand(db: Db, token: string | null, now = new Date()): RiderDemand | null {
  const owner = findSession(db, token, now);
  if (!owner || busyOwner(db, owner.id)) return null;
  const row = db.prepare("SELECT * FROM rider_demands WHERE owner_id=? AND status='OPEN' AND expires_at>?").get(owner.id, now.toISOString()) as Row | undefined;
  return row ? view(db, row) : null;
}

export function pendingDemandOffers(
  db: Db,
  token: string | null,
  now = new Date(),
) {
  const owner = findSession(db, token, now);
  if (!owner) return 0;
  const proposals = (db.prepare(proposalSql + " JOIN rider_demands d ON d.id=p.demand_id WHERE d.owner_id=? AND p.status='PENDING' AND d.expires_at>?").all(owner.id, now.toISOString()) as ProposalRow[]).filter(p => proposalView(db, p, now).status === "PENDING").length;
  return proposals + (
    db
      .prepare(
        `SELECT count(*) AS n FROM rider_demand_offers o
    JOIN rider_demands d ON d.id=o.demand_id JOIN rides r ON r.id=o.ride_id
    WHERE d.owner_id=? AND d.status='OPEN' AND d.expires_at>?
    AND o.status='PENDING' AND r.status IN ('PUBLISHED','REQUESTED')
    AND NOT EXISTS (SELECT 1 FROM rider_demand_offer_withdrawals w WHERE w.offer_id=o.id)
    AND r.scheduled_departure_at>?`,
      )
      .get(owner.id, now.toISOString(), now.toISOString()) as { n: number }
  ).n;
}
export function searchDemands(
  db: Db,
  token: string | null,
  body: unknown,
  now = new Date(),
) {
  const owner = requireUniversitySession(db, token);
  const route = checkedDemandSearch(body, now);
  refresh(db, now);
  const windows = demandWindows(route, now);
  // Iterate until 50 matches, not 50 arbitrary rows before route/time filtering.
  const found: RiderDemand[] = [];
  for (const value of db
    .prepare(
      "SELECT * FROM rider_demands WHERE status='OPEN' ORDER BY created_at DESC",
    )
    .iterate()) {
    const row = value as Row;
    const candidate = view(db, row);
    if (
      busyOwner(db, row.owner_id) ||
      (route.origin && route.destination
        ? !corridorMatches(route.origin, route.destination, candidate)
        : route.origin
          ? distanceMeters(route.origin, candidate.origin) > 1500
          : route.destination
            ? distanceMeters(route.destination, candidate.destination) > 2500
            : false)
    )
      continue;
    const other = demandWindows(candidate, now, candidate.expiresAt);
    if (!windows.some(([a, b]) => other.some(([c, d]) => a < d && c < b)))
      continue;
    found.push({ ...candidate, isOwn: row.owner_id === owner.id });
    if (found.length === 50) break;
  }
  return found;
}
export function cancelDemand(
  db: Db,
  token: string | null,
  id: string,
  now = new Date(),
) {
  const owner = requireUniversitySession(db, token);
  refresh(db, now);
  const row = demand(db, id);
  if (row.owner_id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
  db.prepare(
    "UPDATE rider_demands SET status='CANCELLED' WHERE id=? AND status='OPEN'",
  ).run(id);
}
export function offerDemand(
  db: Db,
  token: string | null,
  id: string,
  body: Record<string, unknown>,
  now = new Date(),
) {
  const owner = requireUniversitySession(db, token);
  if (body.payId != null && typeof body.payId !== "string")
    throw new Error("INVALID_PAYID");
  if (
    body.payIdType != null &&
    !["MOBILE", "EMAIL", "OTHER"].includes(String(body.payIdType))
  )
    throw new Error("INVALID_PAYID_TYPE");
  return db.transaction(() => {
    refresh(db, now);
    const row = demand(db, id);
    if (row.owner_id === owner.id) throw new Error("OWN_RIDE_JOIN_NOT_ALLOWED");
    if (row.status !== "OPEN" || busyOwner(db, row.owner_id))
      throw new Error("DEMAND_UNAVAILABLE");
    const posted = view(db, row);
    // A direct response fulfils the rider's endpoints, not the driver's search filters.
    const route = checkedDemandRoute({ ...posted, date: "any", time: "" }, now);
    const at =
      typeof body.scheduledDepartureAt === "string"
        ? Date.parse(body.scheduledDepartureAt)
        : NaN;
    if (
      !Number.isFinite(at) ||
      at <= +now ||
      !demandWindows(posted, now, row.expires_at).some(
        ([a, b]) => at >= a && at < b,
      )
    )
      throw new Error("REQUEST_TIME_INCOMPATIBLE");
    const previous = db
      .prepare(
        offerSql +
          " WHERE o.demand_id=? AND r.driver_session_id=? AND o.status='PENDING' AND r.status IN ('PUBLISHED','REQUESTED') AND NOT EXISTS (SELECT 1 FROM rider_demand_offer_withdrawals w WHERE w.offer_id=o.id)",
      )
      .get(id, owner.id) as OfferRow | undefined;
    if (previous) return offerView(db, previous, now);
    const pending = (db.prepare(proposalSql + " WHERE p.demand_id=? AND r.driver_session_id=? AND p.status='PENDING'").all(id, owner.id) as ProposalRow[]).find(p => proposalView(db, p, now).status === "PENDING");
    if (pending) return proposalView(db, pending, now);
    const input: CreateRideInput = {
      origin: route.origin, destination: route.destination,
      scheduledDepartureAt: body.scheduledDepartureAt as string,
      priceAud: body.priceAud as number,
      payId: body.payId as string | undefined,
      payIdType: body.payIdType as "MOBILE" | "EMAIL" | "OTHER" | undefined,
    };
    validateRideInput(input, now);
    const current = currentOpenRides(db, token, now);
    const source = current.find(item => item.role === "DRIVER");
    if (current.some(item => item.role !== "DRIVER" || !["PUBLISHED", "REQUESTED"].includes(item.ride.status))) throw new Error("OPEN_ITEM_EXISTS");
    if (source && body.replacePostedRideId !== source.ride.rideId) throw new Error("POSTED_JOURNEY_REPLACEMENT_REQUIRED");
    if (!source && body.replacePostedRideId !== undefined) throw new Error("DEMAND_UNAVAILABLE");
    let vehicle = readVehicle(db, owner.id);
    if (body.plate !== undefined)
      vehicle = saveVehicle(db, owner.id, {
        ...(vehicle ?? emptyVehicle),
        plate: body.plate,
      });
    if (!vehicle?.plate) throw new Error("VEHICLE_PLATE_REQUIRED");
    if (source) {
      const internal = db.prepare("SELECT id FROM rides WHERE public_id=?").get(source.ride.rideId) as { id: string };
      const offerId = randomUUID();
      db.prepare("INSERT INTO rider_demand_proposals VALUES (?,?,?,?,'PENDING',?)").run(offerId, id, internal.id, JSON.stringify(input), now.toISOString());
      queueNotification(db, row.owner_id, "OFFER", offerId, `demand-offer:${offerId}`, now);
      return proposalView(db, db.prepare(proposalSql + " WHERE p.id=?").get(offerId) as ProposalRow, now);
    }
    const { ride } = publishRide(
      db,
      token,
      {
        origin: route.origin,
        destination: route.destination,
        withdrawLiftRequestId: typeof body.withdrawLiftRequestId === "string" ? body.withdrawLiftRequestId : undefined,
        scheduledDepartureAt: body.scheduledDepartureAt as string,
        priceAud: body.priceAud as number,
        payId: body.payId as string | undefined,
        payIdType: body.payIdType as "MOBILE" | "EMAIL" | "OTHER" | undefined,
      },
      now,
    );
    const internal = db
      .prepare("SELECT id FROM rides WHERE public_id=?")
      .get(ride.rideId) as { id: string };
    const offerId = randomUUID();
    db.prepare(
      "INSERT INTO rider_demand_offers VALUES (?,?,?,'PENDING',?)",
    ).run(offerId, id, internal.id, now.toISOString());
    queueNotification(db, row.owner_id, "OFFER", offerId, `demand-offer:${offerId}`, now);
    return offerView(
      db,
      db.prepare(offerSql + " WHERE o.id=?").get(offerId) as OfferRow,
      now,
    );
  })();
}
export function withdrawDemandOffer(db: Db, token: string | null, id: string, now = new Date()) {
  const owner = requireUniversitySession(db, token);
  return db.transaction(() => {
    refresh(db, now);
    const proposal = db.prepare(proposalSql + " WHERE p.id=?").get(id) as ProposalRow | undefined;
    const offer = db.prepare(offerSql + " WHERE o.id=?").get(id) as OfferRow | undefined;
    const row = proposal ?? offer;
    if (!row) throw new Error("DEMAND_NOT_FOUND");
    if (row.driver_session_id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
    if (offerWithdrawn(db, id)) return;
    const status = proposal ? proposalView(db, proposal, now).status : offerView(db, offer!, now).status;
    if (status !== "PENDING") throw new Error("DEMAND_UNAVAILABLE");
    db.prepare("INSERT INTO rider_demand_offer_withdrawals VALUES (?,?,?)").run(id, owner.id, now.toISOString());
  })();
}

export function respondToDemandOffer(
  db: Db,
  token: string | null,
  id: string,
  decision: unknown,
  now = new Date(),
) {
  const owner = requireUniversitySession(db, token);
  if (decision !== "ACCEPT" && decision !== "DECLINE")
    throw new Error("INVALID_DECISION");
  return db.transaction(() => {
    refresh(db, now);
    const proposal = db.prepare(proposalSql + " WHERE p.id=? AND p.status!='ACCEPTED'").get(id) as ProposalRow | undefined;
    if (proposal) {
      const posted = demand(db, proposal.demand_id);
      if (posted.owner_id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
      if (proposalView(db, proposal, now).status !== "PENDING") throw new Error("DEMAND_UNAVAILABLE");
      if (decision === "DECLINE") {
        db.prepare("UPDATE rider_demand_proposals SET status='DECLINED' WHERE id=?").run(id);
        return null;
      }
      // Persisted proposal is the driver's consent. Everything below rolls back
      // together, including the previous public journey and its pending requests.
      const actor = { id: proposal.driver_session_id, alias: proposal.driver_alias };
      replacePostedJourney(db, actor, proposal.public_id, now);
      const ride = publishRideForDriver(db, actor, JSON.parse(proposal.body), now, false);
      const internal = db.prepare("SELECT id FROM rides WHERE public_id=?").get(ride.rideId) as { id: string };
      db.prepare("INSERT INTO rider_demand_offers VALUES (?,?,?,'PENDING',?)").run(id, proposal.demand_id, internal.id, proposal.created_at);
      db.prepare("UPDATE rider_demand_proposals SET status='ACCEPTED' WHERE id=?").run(id);
      // Continue through the existing checked pairing, plate and pickup-code path.
    }
    const offer = db.prepare(offerSql + " WHERE o.id=?").get(id) as
      OfferRow | undefined;
    if (!offer) throw new Error("DEMAND_NOT_FOUND");
    const row = demand(db, offer.demand_id);
    if (row.owner_id !== owner.id) throw new Error("RIDE_ACCESS_DENIED");
    if (offer.status === "ACCEPTED" && decision === "ACCEPT")
      return getRide(db, offer.public_id, owner, now);
    if (offerView(db, offer, now).status !== "PENDING")
      throw new Error("DEMAND_UNAVAILABLE");
    if (decision === "DECLINE") {
      db.prepare(
        "UPDATE rider_demand_offers SET status='DECLINED' WHERE id=?",
      ).run(id);
      return null; // Driver's ordinary public offer remains available.
    }
    const current = currentOpenRides(db, token, now);
    if (current.some(item => item.role !== "RIDER" || item.ride.request?.status !== "PENDING"))
      throw new Error("OPEN_ITEM_EXISTS");
    const posted = view(db, row);
    const vehicle = readVehicle(db, offer.driver_session_id);
    if (!vehicle?.plate) throw new Error("VEHICLE_PLATE_REQUIRED");
    // Explicitly accepting this offer replaces pending joins atomically. A failure
    // below rolls these withdrawals back along with the new pairing.
    for (const item of current) cancelPendingRequest(db, token, item.ride.rideId, now);
    const joined = requestRide(
      db,
      token,
      offer.public_id,
      {
        pickup: posted.origin,
        destination: posted.destination,
        requestedDepartureAt: offer.scheduled_departure_at,
      },
      now,
    );
    // Driver consent is the persisted offer, never an actor supplied by the browser.
    decideRequestForDriver(
      db,
      { id: offer.driver_session_id, alias: offer.driver_alias },
      offer.public_id,
      joined.ride.request!.requestId,
      "ACCEPT",
      now,
    );
    // The rider just explicitly accepted this offer, so do not email them a
    // second notification that their own acceptance succeeded.
    reviewNotifications(db, owner.id, [`${offer.public_id}:${joined.ride.request!.requestId}:accepted:${now.toISOString()}`], now);
    snapshotVehicle(db, offer.public_id, vehicle);
    db.prepare(
      "UPDATE rider_demand_offers SET status='ACCEPTED' WHERE id=?",
    ).run(id);
    db.prepare("UPDATE rider_demands SET status='FULFILLED' WHERE id=?").run(
      row.id,
    );
    return getRide(db, offer.public_id, owner, now);
  })();
}

/** Resolve reminders through the same availability rules used by the rider UI. */
export function pendingOfferNotification(db: Db, id: string, principal: string, now: Date): string | null {
  const ordinary = db.prepare(offerSql + " WHERE o.id=?").get(id) as OfferRow | undefined;
  const proposal = ordinary ? undefined : db.prepare(proposalSql + " WHERE p.id=?").get(id) as ProposalRow | undefined;
  const row = ordinary ?? proposal;
  if (!row) return null;
  const request = demand(db, row.demand_id);
  if (request.owner_id !== principal || request.status !== "OPEN" || Date.parse(request.expires_at) <= +now || busyOwner(db, principal)) return null;
  const offer = ordinary ? offerView(db, ordinary, now) : proposalView(db, proposal!, now);
  return offer.status === "PENDING" ? `/activity/requests/${encodeURIComponent(request.id)}#offer-${encodeURIComponent(id)}` : null;
}
