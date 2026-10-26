import test from "node:test";
import assert from "node:assert/strict";
import { journeyUpdates, journeyUpdatesHref } from "../lib/journey-updates";
import type { ActiveRide } from "../components/active-ride-link";
import type { DemandActivity } from "../lib/rider-demand";

const pin = { latitude: 0, longitude: 0 };
const rider: ActiveRide = { role: "RIDER", ride: {
  rideId: "ride-1", driverAlias: "driver", status: "ACCEPTED", priceAud: 0,
  scheduledDepartureAt: "", expiresAt: "", request: {
    requestId: "join-1", riderAlias: "rider", status: "ACCEPTED", pickup: pin,
    destination: pin, directionFit: "GOOD", requestedDepartureAt: "", decidedAt: "today",
  },
} };
const demands: DemandActivity = { requests: [{ id: "post-1", alias: "rider", status: "OPEN",
  origin: pin, destination: pin, date: "any", time: "", createdAt: "", expiresAt: "",
  offers: ["offer-1", "offer-2"].map(id => ({ id, demandId: "post-1", rideId: id,
    driverAlias: "driver", departureAt: "", priceAud: 0, origin: pin, destination: pin, status: "PENDING" })),
}], sent: [] };

test("one journey opens its acceptance; no updates opens ordinary Activity", () => {
  const result = journeyUpdates([rider], null, []);
  assert.equal(journeyUpdatesHref(result.groups), "/activity/ride-1?request=join-1#pickup-ride-1");
  assert.equal(journeyUpdatesHref([]), "/activity");
  assert.equal(journeyUpdates([rider], null, result.notices.map(n => n.key)).groups.length, 0);
});
test("several offers on one post remain one destination with independent read markers", () => {
  const result = journeyUpdates([], demands, []);
  assert.equal(result.groups.length, 1);
  assert.equal(result.notices.length, 2);
  assert.equal(journeyUpdatesHref(result.groups), "/activity/requests/post-1#offer-offer-1");
  assert.equal(journeyUpdatesHref(journeyUpdates([], demands, ["demand-offer:offer-1"]).groups), "/activity/requests/post-1#offer-offer-2");
  assert.equal(journeyUpdates([], demands, result.notices.map(n => n.key)).groups.length, 0);
});
test("distinct journeys go to Activity; fulfilled post adds no duplicate acceptance", () => {
  assert.equal(journeyUpdatesHref(journeyUpdates([rider], demands, []).groups), "/activity#updates");
  const closed: DemandActivity = { ...demands, requests: demands.requests.map(r => ({ ...r, status: "FULFILLED" })) };
  assert.equal(journeyUpdates([rider], closed, []).groups.length, 1);
});
test("messages and requests on the same driver journey group without acknowledging messages", () => {
  const driver: ActiveRide = { role: "DRIVER", ride: { ...rider.ride, requests: [
    { ...rider.ride.request!, status: "PENDING" }, { ...rider.ride.request!, requestId: "join-2", status: "PENDING" },
  ], conversations: [{ requestId: "join-1", unread: 3, peer: "rider", stopped: false }] } };
  const result = journeyUpdates([driver], null, []);
  assert.equal(result.groups.length, 1);
  assert.equal(result.notices.length, 2);
  const messagesOnly = journeyUpdates([driver], null, result.notices.map(n => n.key));
  assert.equal(messagesOnly.groups.length, 1);
  assert.match(messagesOnly.groups[0].href, /#messages-/);
  assert.equal(messagesOnly.notices.length, 0);
});
