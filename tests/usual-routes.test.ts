import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  initializeCoreSchema,
  createGuestSession,
  publishRide,
  cancelRide,
} from "../server/core";
import { createApiServer } from "../server/index";
import {
  validateUsualRoute,
  saveUsualRoute,
  saveSearchRoute,
  readUsualRoute,
  removeUsualRoute,
  scheduleMatches,
  corridorMatches,
  queueRouteAlerts,
  deliverRouteAlerts,
} from "../server/usual-routes";
import type { UsualRoute } from "../lib/usual-route";

const now = new Date("2026-10-21T01:00:00Z"); // Wednesday noon Sydney, AEDT
const start = { latitude: -33.88, longitude: 151.18, label: "Start" };
const end = { latitude: -33.88, longitude: 151.28, label: "End" };
const route: UsualRoute = {
  origin: { ...start, longitude: 151.2 },
  destination: { ...end, longitude: 151.25 },
  days: [3],
  minute: 720,
  alerts: true,
  priceAud: 5,
  payId: "",
  payIdType: "MOBILE",
};
test("search save requires explicit consent, preserves preferences and rejects stale writes", () => {
  const { db, rider } = setup();
  try {
    const initial = saveSearchRoute(db, rider.session.id, { origin: start, destination: end, expected: null });
    assert.equal(initial.alerts, false);
    assert.equal(initial.anyTime, true);
    assert.ok(scheduleMatches(initial, new Date("2026-10-25T15:00:00Z")));
    assert.equal(scheduleMatches({ ...route, alerts: false, days: [], minute: null }, now), false);
    assert.throws(() => validateUsualRoute({ ...route, anyTime: true }));
    assert.throws(() => validateUsualRoute({ ...initial, anyTime: "true" }));
    assert.throws(() => saveSearchRoute(db, rider.session.id, { origin: end, destination: start, expected: null }), /USUAL_ROUTE_CHANGED/);
    const configured = saveUsualRoute(db, rider.session.id, { ...route, alerts: false, payIdType: "EMAIL", payId: "private@example.com" });
    const replacement = saveSearchRoute(db, rider.session.id, { origin: start, destination: end, expected: configured });
    assert.equal(replacement.alerts, false);
    assert.deepEqual(replacement.days, route.days);
    assert.equal(replacement.minute, route.minute);
    assert.equal(replacement.payId, "private@example.com");
    assert.equal(replacement.priceAud, 5);
    const optedIn = saveUsualRoute(db, rider.session.id, { ...replacement, alerts: true });
    const enabledReplacement = saveSearchRoute(db, rider.session.id, { origin: end, destination: start, expected: optedIn });
    assert.equal(enabledReplacement.alerts, true);
    saveUsualRoute(db, rider.session.id, { ...enabledReplacement, alerts: false });
    assert.throws(() => saveSearchRoute(db, rider.session.id, { origin: end, destination: start, expected: enabledReplacement, notify: true }), /USUAL_ROUTE_CHANGED/);
  } finally { db.close(); }
});
test("search email consent enables all-time matching only explicitly and queues future offers once", async () => {
  const { db, rider, offer } = setup();
  const keys = ["COCOWHEELS_ROUTE_ALERTS_ENABLED", "COCOWHEELS_RESEND_API_KEY", "COCOWHEELS_EMAIL_FROM", "COCOWHEELS_PUBLIC_ORIGIN"];
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.COCOWHEELS_ROUTE_ALERTS_ENABLED = "0";
    const saved = saveSearchRoute(db, rider.session.id, { origin: route.origin, destination: route.destination, expected: null });
    assert.throws(() => saveSearchRoute(db, rider.session.id, { origin: route.origin, destination: route.destination, expected: saved, notify: true }), /ALERTS_UNAVAILABLE/);
    assert.equal(readUsualRoute(db, rider.session.id)?.alerts, false);
    keys.forEach((key) => { process.env[key] = key.endsWith("ENABLED") ? "1" : "test-only"; });
    const consented = saveSearchRoute(db, rider.session.id, { origin: route.origin, destination: route.destination, expected: saved, notify: true });
    assert.equal(consented.alerts, true);
    assert.equal(consented.anyTime, true);
    assert.equal((db.prepare("SELECT count(*) n FROM route_alerts").get() as { n: number }).n, 0);
    offer();
    let sends = 0;
    await deliverRouteAlerts(db, async () => { sends++; }, now);
    await deliverRouteAlerts(db, async () => { sends++; }, now);
    assert.equal(sends, 1);
  } finally {
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
    db.close();
  }
});
test("alert delivery continues beyond former global caps without duplicate sends", async () => {
  for (const count of [20, 50, 100]) {
    const { db, rider, offer } = setup();
    try {
      saveUsualRoute(db, rider.session.id, route, now);
      offer();
      const job = db.prepare("SELECT id FROM route_alerts").get() as {
        id: string;
      };
      const at = now.getTime() - (count === 50 ? 7200000 : 1000);
      for (let i = 0; i < count; i++)
        db.prepare(
          "INSERT INTO route_alert_attempts (alert_id, attempted_at) VALUES (?, ?)",
        ).run(job.id, at);
      let sends = 0;
      for (let i = 0; i < 2; i++)
        await deliverRouteAlerts(
          db,
          async () => {
            sends++;
          },
          now,
        );
      assert.equal(sends, 1);
      assert.equal(
        (
          db.prepare("SELECT attempts FROM route_alerts").get() as {
            attempts: number;
          }
        ).attempts,
        1,
      );
      assert.equal(
        (
          db
            .prepare("SELECT count(*) AS n FROM route_alert_attempts")
            .get() as { n: number }
        ).n,
        count + 1,
      );
    } finally {
      db.close();
    }
  }
});
test("alerts suppress active recipients", async () => {
  const { db, rider, offer } = setup();
  try {
    saveUsualRoute(db, rider.session.id, route, now);
    offer();
    publishRide(
      db,
      rider.token,
      {
        origin: start,
        destination: end,
        scheduledDepartureAt: now.toISOString(),
        priceAud: 5,
        payId: "rider@example.com",
        payIdType: "EMAIL",
      },
      now,
    );
    await deliverRouteAlerts(
      db,
      async () => assert.fail("active recipient must not receive an alert"),
      now,
    );
    assert.equal(
      (
        db.prepare("SELECT status FROM route_alerts").get() as {
          status: string;
        }
      ).status,
      "SKIPPED",
    );
  } finally {
    db.close();
  }
});
function setup() {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  const account = (name: string) => {
    const guest = createGuestSession(db, now);
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(
      name,
      guest.session.id,
      now.toISOString(),
    );
    const token = `verified-${name}`;
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(
      createHash("sha256").update(token).digest("hex"),
      name,
      guest.session.id,
      "2099-01-01T00:00:00Z",
    );
    return { ...guest, token };
  };
  const driver = account("driv1234"),
    rider = account("ride1234");
  const offer = () =>
    publishRide(
      db,
      driver.token,
      {
        origin: start,
        destination: end,
        scheduledDepartureAt: now.toISOString(),
        priceAud: 5,
        payId: "driver@example.com",
        payIdType: "EMAIL",
      },
      now,
    );
  return { db, driver, rider, offer };
}
test("strict private route validation, one record per account, soft removal", () => {
  const { db, rider, driver } = setup();
  try {
    saveUsualRoute(db, rider.session.id, route, now);
    assert.deepEqual(readUsualRoute(db, rider.session.id), route);
    assert.equal(readUsualRoute(db, driver.session.id), null);
    for (const patch of [
      { days: [] },
      { minute: null },
      { days: [3, 3] },
      { days: [8] },
      { minute: 1440 },
      { alerts: "true" },
      { priceAud: 0.99 },
      { priceAud: 5.555 },
      { payId: "bad", payIdType: "EMAIL" },
      { origin: { ...start, latitude: 91 } },
      { destination: { ...end, label: "x".repeat(161) } },
    ])
      assert.throws(() => validateUsualRoute({ ...route, ...patch }));
    saveUsualRoute(db, rider.session.id, { ...route, alerts: false }, now);
    assert.equal(
      (db.prepare("SELECT count(*) n FROM usual_routes").get() as { n: number })
        .n,
      1,
    );
    removeUsualRoute(db, rider.session.id);
    assert.equal(readUsualRoute(db, rider.session.id), null);
    assert.equal(
      (db.prepare("SELECT count(*) n FROM usual_routes").get() as { n: number })
        .n,
      1,
    );
  } finally {
    db.close();
  }
});
test("Sydney schedule boundaries, weekdays, midnight and daylight saving", () => {
  assert.ok(scheduleMatches(route, now));
  assert.ok(scheduleMatches(route, new Date("2026-10-21T00:00:00Z")));
  assert.ok(scheduleMatches(route, new Date("2026-10-21T02:00:00Z")));
  assert.ok(!scheduleMatches(route, new Date("2026-10-21T02:01:00Z")));
  assert.ok(!scheduleMatches(route, new Date("2026-10-22T01:00:00Z")));
  assert.ok(scheduleMatches(route, new Date("2026-07-22T02:00:00Z"))); // AEST noon
  assert.ok(
    scheduleMatches(
      { ...route, days: [1], minute: 0 },
      new Date("2026-10-25T12:30:00Z"),
    ),
  ); // Sunday 23:30
});
test("corridor rejects reverse direction and far-away routes", () => {
  assert.ok(corridorMatches(start, end, route));
  assert.ok(
    !corridorMatches(start, end, {
      ...route,
      origin: route.destination,
      destination: route.origin,
    }),
  );
  assert.ok(
    !corridorMatches(start, end, {
      ...route,
      origin: { ...start, latitude: -34.5 },
    }),
  );
});
test("pickup behind origin allows 20 percent while preserving other corridor bounds", () => {
  const origin = { latitude: 0, longitude: 0 };
  const destination = { latitude: 0.04, longitude: 0 };
  const matches = (pickup: typeof origin, dropoff = destination) =>
    corridorMatches(origin, destination, { ...route, origin: pickup, destination: dropoff });
  // Synthetic regression: pickup behind and sideways, not private GPS samples.
  assert.ok(matches({ latitude: -0.04 * 0.0622, longitude: 0.0055 }));
  assert.ok(matches({ latitude: -0.04 * 0.1999, longitude: 0 }));
  assert.ok(matches({ latitude: -0.04 * 0.20, longitude: 0 }));
  assert.equal(matches({ latitude: -0.04 * 0.2001, longitude: 0 }), false);
  assert.equal(matches({ latitude: -0.004, longitude: 0.02 }), false);
  assert.equal(matches(origin, { latitude: 0.04 * 1.0501, longitude: 0 }), false);
  assert.equal(matches(origin, { latitude: 0.04, longitude: 0.03 }), false);
  assert.equal(matches({ latitude: 0.03, longitude: 0 }, { latitude: 0.02, longitude: 0 }), false);
  // Short trips still use percentages, not a new fixed radius; long trips retain 1.5km cap.
  assert.ok(corridorMatches(origin, { latitude: 0.002, longitude: 0 }, {
    ...route, origin: { latitude: -0.00039, longitude: 0 }, destination: { latitude: 0.002, longitude: 0 },
  }));
  assert.equal(corridorMatches(origin, { latitude: 0.1, longitude: 0 }, {
    ...route, origin: { latitude: -0.019, longitude: 0 }, destination: { latitude: 0.1, longitude: 0 },
  }), false);
  assert.equal(corridorMatches(origin, { latitude: 0.0005, longitude: 0 }, {
    ...route, origin, destination: { latitude: 0.0005, longitude: 0 },
  }), false);
});

test("newly eligible pickup queues and delivers once without backfilling old offers", async () => {
  const { db, driver, rider, offer } = setup();
  try {
    const behind = { ...route, origin: { ...start, longitude: start.longitude - 0.01 } };
    saveUsualRoute(db, rider.session.id, behind, now);
    offer();
    const ride = db.prepare("SELECT id FROM rides WHERE driver_session_id=?").get(driver.session.id) as { id: string };
    assert.equal((db.prepare("SELECT count(*) n FROM route_alerts").get() as {n:number}).n, 1);
    queueRouteAlerts(db, ride.id, driver.session.id, start, end, now.toISOString(), now);
    assert.equal((db.prepare("SELECT count(*) n FROM route_alerts").get() as {n:number}).n, 1);
    let sends = 0;
    await deliverRouteAlerts(db, async () => { sends++; }, now);
    await deliverRouteAlerts(db, async () => { sends++; }, now);
    assert.equal(sends, 1);
  } finally { db.close(); }
  const second = setup();
  try {
    second.offer();
    saveUsualRoute(second.db, second.rider.session.id, { ...route, origin: { ...start, longitude: start.longitude - 0.01 } }, now);
    const db = second.db;
    assert.equal((db.prepare("SELECT count(*) n FROM route_alerts").get() as {n:number}).n, 0);
  } finally { second.db.close(); }
});

test("publication queues once, sends once, has no private address or PayID in email", async () => {
  const { db, rider, offer } = setup();
  try {
    saveUsualRoute(db, rider.session.id, route, now);
    offer();
    assert.equal(
      (db.prepare("SELECT count(*) n FROM route_alerts").get() as { n: number })
        .n,
      1,
    );
    let sends = 0;
    await deliverRouteAlerts(
      db,
      async (email) => {
        sends++;
        assert.equal(email.to[0], "ride1234@uni.sydney.edu.au");
        assert.match(email.text, /Leaving at 12:00 pm on Friday, 23 October/);
        assert.ok(!email.text.includes("driver@example.com"));
        assert.ok(!email.text.includes("151.20"));
        assert.match(email.text, /\?start=rider&match=/);
        assert.match(email.html!, /View matching ride/);
        assert.match(email.html!, /usual-route\?alerts=1/);
        assert.ok(!email.html!.includes("driver@example.com"));
        assert.ok(!email.html!.includes("151.20"));
      },
      now,
    );
    await deliverRouteAlerts(
      db,
      async () => {
        sends++;
      },
      now,
    );
    assert.equal(sends, 1);
  } finally {
    db.close();
  }
});
test("mute, replacement, cancellation and expired alert suppress delivery", async () => {
  for (const reason of ["mute", "replace", "cancel", "deadline"]) {
    const { db, rider, driver, offer } = setup();
    try {
      saveUsualRoute(db, rider.session.id, route, now);
      const result = offer();
      if (reason === "mute")
        saveUsualRoute(db, rider.session.id, { ...route, alerts: false }, now);
      if (reason === "replace") removeUsualRoute(db, rider.session.id);
      if (reason === "cancel")
        cancelRide(db, driver.token, result.ride.rideId, now);
      await deliverRouteAlerts(
        db,
        async () => {
          assert.fail("must not send");
        },
        reason === "deadline" ? new Date(now.getTime() + 3600001) : now,
      );
      assert.equal(
        (
          db.prepare("SELECT status FROM route_alerts").get() as {
            status: string;
          }
        ).status,
        "SKIPPED",
      );
    } finally {
      db.close();
    }
  }
});
test("retries preserve payload and idempotency key and stop after three attempts", async () => {
  const { db, rider, offer } = setup();
  try {
    saveUsualRoute(db, rider.session.id, route, now);
    offer();
    const sent: string[] = [];
    for (let i = 0; i < 4; i++)
      await deliverRouteAlerts(
        db,
        async (email, id) => {
          sent.push(JSON.stringify({ email, id }));
          throw new Error("network");
        },
        new Date(now.getTime() + i * 60001),
      );
    assert.equal(sent.length, 3);
    assert.equal(new Set(sent).size, 1);
    assert.equal(
      (
        db.prepare("SELECT count(*) n FROM route_alert_attempts").get() as {
          n: number;
        }
      ).n,
      3,
    );
  } finally {
    db.close();
  }
});
test("HTTP saved-route access is owner-scoped; fresh GPS and departure choices enforced", async () => {
  const { db, rider, driver } = setup();
  const api = createApiServer(db);
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const call = (path: string, token?: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/usual-route${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await call("")).status, 401);
    assert.equal((await call("/from-search", undefined, { origin: start, destination: end, expected: null })).status, 401);
    const shortcut = await call("/from-search", rider.token, { origin: start, destination: end, expected: null, principal_id: driver.session.id });
    assert.equal(shortcut.status, 200);
    const shortcutRoute = (await shortcut.json()).route;
    assert.equal(shortcutRoute.alerts, false);
    assert.equal(shortcutRoute.anyTime, true);
    assert.equal((await call("/from-search", rider.token, { origin: end, destination: start, expected: null })).status, 409);
    assert.equal((await (await call("", driver.token)).json()).route, null);
    assert.equal(
      (
        await call("", rider.token, {
          ...route,
          principal_id: driver.session.id,
        })
      ).status,
      200,
    );
    assert.equal((await (await call("", driver.token)).json()).route, null);
    for (const departureMinutes of [15, -30, 1470, 30.5, "30", null]) {
      assert.equal(
        (await call("/offer", rider.token, { departureMinutes })).status,
        400,
      );
    }
    assert.equal(
      (
        await call("/offer", rider.token, {
          departureMinutes: 30,
          capturedAt: new Date(Date.now() - 60000).toISOString(),
          accuracyMeters: 10,
          origin: start,
        })
      ).status,
      400,
    );
    assert.equal((await call("/remove", driver.token, {})).status, 200);
    assert.ok((await (await call("", rider.token)).json()).route);
    await call("", driver.token, {
      ...route,
      alerts: false,
      payId: "driver@example.com",
      payIdType: "EMAIL",
    });
    const gps = { ...start, longitude: 151.19, label: "Current location" };
    const result = await call("/offer", driver.token, {
      departureMinutes: 1440,
      capturedAt: new Date().toISOString(),
      accuracyMeters: 10,
      origin: gps,
      destination: start,
      priceAud: 999,
      payId: "attacker@example.com",
    });
    assert.equal(result.status, 201);
    const offered = (await result.json()).ride;
    assert.equal(offered.plannedRoute.origin.longitude, gps.longitude);
    assert.equal(offered.priceAud, route.priceAud);
    assert.equal(
      offered.plannedRoute.destination.longitude,
      route.destination.longitude,
    );
    assert.ok(
      Math.abs(
        Date.parse(offered.scheduledDepartureAt) - Date.now() - 86400000,
      ) < 5000,
    );
    assert.equal(
      (
        await call("/offer", driver.token, {
          departureMinutes: 0,
          capturedAt: new Date().toISOString(),
          accuracyMeters: 10,
          origin: gps,
        })
      ).status,
      409,
    );
    assert.equal(
      (db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n,
      1,
    );
    await call("/remove", driver.token, {});
    assert.equal(
      (db.prepare("SELECT count(*) n FROM rides").get() as { n: number }).n,
      1,
    );
    await call("", rider.token, {
      ...route,
      alerts: false,
      priceAud: 0,
      payId: "",
    });
    const freeResult = await call("/offer", rider.token, {
      departureMinutes: 0,
      capturedAt: new Date().toISOString(),
      accuracyMeters: 10,
      origin: gps,
      priceAud: 999,
      payId: "attacker@example.com",
    });
    assert.equal(freeResult.status, 201);
    const freeRide = (await freeResult.json()).ride;
    assert.equal(freeRide.priceAud, 0);
    assert.equal(freeRide.payId, null);
    cancelRide(db, rider.token, freeRide.rideId);
    const direct = await fetch(`http://127.0.0.1:${address.port}/api/rides`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rider.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: gps,
        destination: route.destination,
        scheduledDepartureAt: new Date().toISOString(),
        priceAud: 0,
        payId: "",
      }),
    });
    assert.equal(direct.status, 201);
    assert.equal((await direct.json()).ride.priceAud, 0);
  } finally {
    api.close();
    api.closeAllConnections();
    await once(api, "close");
    db.close();
  }
});
