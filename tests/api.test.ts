import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { openDatabase } from "../server/db";
import { createGuestSession } from "../server/core";
import { createApiServer } from "../server/index";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);
const inbox = new Map<string, string>();
const sendUniversityCode = async (email: string, code: string) => {
  inbox.set(email, code);
};
async function universityLogin(base: string, unikey: string) {
  const start = await json(`${base}/api/university/code`, "POST", { unikey });
  assert.equal(start.response.status, 200);
  const result = await json(`${base}/api/university/verify`, "POST", {
    challengeId: start.body.challengeId,
    code: inbox.get(`${unikey}@uni.sydney.edu.au`),
  });
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get("set-cookie")!, /HttpOnly/);
  assert.equal(result.body.sessionToken, undefined);
  return decodeURIComponent(
    result.response.headers.get("set-cookie")!.split(";")[0].split("=")[1],
  );
}

async function json(
  url: string,
  method: string,
  body?: unknown,
  token?: string,
  fallback = false,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Cocowheels-Auth": "1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fallback ? { "X-Cocowheels-Session-Fallback": "1" } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

test("sample HTTP flow accepts, reserves, simulates and releases a sample", async () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "cocowheels-sample-api-"),
  );
  const database = openDatabase(path.join(directory, "test.db"));
  const api = createApiServer(database, { sendUniversityCode });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const list = await json(`${base}/api/availability`, "GET");
    const id = (list.body.rides as Array<{ rideId: string }>)[0].rideId;
    const preview = await json(`${base}/api/rides/${id}/preview`, "GET");
    const route = (
      preview.body.ride as {
        plannedRoute: { origin: unknown; destination: unknown };
      }
    ).plannedRoute;
    const token = await universityLogin(base, "test0001");
    const joined = await json(
      `${base}/api/rides/${id}/requests`,
      "POST",
      {
        pickup: route.origin,
        destination: route.destination,
        requestedDepartureAt: new Date().toISOString(),
      },
      token,
      true,
    );
    assert.equal(joined.response.status, 201);
    assert.equal((joined.body.ride as { status: string }).status, "ACCEPTED");
    assert.equal(
      ((await json(`${base}/api/availability`, "GET")).body.rides as unknown[])
        .length,
      2,
    );
    assert.equal(
      (
        await json(`${base}/api/rides/${id}/sample`, "POST", {
          action: "START",
        })
      ).response.status,
      401,
    );
    for (const [action, status] of [
      ["START", "RIDE_ACTIVE"],
      ["PICKUP", "CO_RIDE_ACTIVE"],
    ]) {
      const result = await json(
        `${base}/api/rides/${id}/sample`,
        "POST",
        { action },
        token,
      );
      assert.equal(result.response.status, 200);
      assert.equal((result.body.ride as { status: string }).status, status);
      assert.equal(
        (
          (await json(`${base}/api/availability`, "GET")).body
            .rides as unknown[]
        ).length,
        2,
      );
    }
    const completed = await json(
      `${base}/api/rides/${id}/complete`,
      "POST",
      { method: "CASH" },
      token,
    );
    assert.equal(completed.response.status, 200);
    const renewed = (await json(`${base}/api/availability`, "GET")).body
      .rides as Array<{ rideId: string }>;
    assert.equal(renewed.length, 3);
    assert.equal(
      renewed.some((ride) => ride.rideId === id),
      false,
    );
  } finally {
    api.close();
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("HTTP API issues an HttpOnly guest cookie, enforces access boundaries, and completes the protected lifecycle", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "cocowheels-api-"));
  const database = openDatabase(path.join(directory, "test.db"));
  const api = createApiServer(database, {
    sampleRides: false,
    sendUniversityCode,
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const driverToken = await universityLogin(base, "driv0001");
    const riderToken = await universityLogin(base, "ride0001");
    const driverCreate = await json(
      `${base}/api/rides`,
      "POST",
      {
        origin: {
          latitude: -33.8688,
          longitude: 151.2093,
          label: "hidden origin",
        },
        destination: {
          latitude: -33.81,
          longitude: 151.28,
          label: "hidden destination",
        },
        scheduledDepartureAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        priceAud: 10,
        payId: "driver@example.com",
        payIdType: "EMAIL",
      },
      driverToken,
      true,
    );
    assert.equal(driverCreate.response.status, 201);
    const driverRide = driverCreate.body.ride as {
      rideId: string;
      driverAlias: string;
    };
    assert.match(driverToken, /[A-Za-z0-9_-]{30,}/);
    const driverCurrent = await json(
      `${base}/api/current`,
      "GET",
      undefined,
      driverToken,
    );
    assert.equal(driverCurrent.body.guestAlias, driverRide.driverAlias);
    const riderSearch = await json(`${base}/api/search`, "POST", {
      pickup: { latitude: -33.855, longitude: 151.225 },
      destination: { latitude: -33.82, longitude: 151.265 },
      requestedDepartureAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    assert.equal(riderSearch.response.status, 200);
    const candidates = riderSearch.body.candidates as Array<
      Record<string, unknown>
    >;
    assert.equal(candidates.length, 1);
    assert.equal("origin" in candidates[0], false);
    const riderCreate = await json(
      `${base}/api/rides/${driverRide.rideId}/requests`,
      "POST",
      {
        pickup: { latitude: -33.855, longitude: 151.225 },
        destination: { latitude: -33.82, longitude: 151.265 },
        requestedDepartureAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      },
      riderToken,
      true,
    );
    assert.equal(riderCreate.response.status, 201);
    const riderRide = riderCreate.body.ride as {
      request: { requestId: string };
    };
    const anonymous = createGuestSession(database).token;
    const privateAttempt = await json(
      `${base}/api/rides/${driverRide.rideId}`,
      "GET",
      undefined,
      anonymous,
    );
    assert.equal(privateAttempt.response.status, 403);
    const accepted = await json(
      `${base}/api/rides/${driverRide.rideId}/requests/${riderRide.request.requestId}`,
      "PATCH",
      { decision: "ACCEPT" },
      driverToken,
    );
    assert.equal(accepted.response.status, 200);
    const acceptedRiderState = await json(
      `${base}/api/rides/${driverRide.rideId}`,
      "GET",
      undefined,
      riderToken,
    );
    assert.equal(
      (acceptedRiderState.body.ride as Record<string, unknown>).payId,
      "driver@example.com",
    );
    assert.equal(
      (acceptedRiderState.body.ride as Record<string, unknown>).payIdType,
      "EMAIL",
    );
    const stale = new Date(Date.now() - 3 * 60_000).toISOString();
    const driverLocation = {
      latitude: -33.868,
      longitude: 151.209,
      accuracyMeters: 8,
      capturedAt: stale,
    };
    const riderLocation = {
      latitude: -33.855,
      longitude: 151.225,
      accuracyMeters: 8,
      capturedAt: stale,
    };
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/location`,
          "POST",
          driverLocation,
          driverToken,
        )
      ).response.status,
      400,
      "stale test coordinate is rejected",
    );
    const fresh = new Date().toISOString();
    driverLocation.capturedAt = fresh;
    riderLocation.capturedAt = fresh;
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/location`,
          "POST",
          driverLocation,
          driverToken,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/location`,
          "POST",
          riderLocation,
          riderToken,
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/begin`,
          "POST",
          {},
          driverToken,
        )
      ).response.status,
      200,
    );
    const riderState = await json(
      `${base}/api/rides/${driverRide.rideId}`,
      "GET",
      undefined,
      riderToken,
    );
    const ride = riderState.body.ride as Record<string, unknown>;
    assert.match(ride.coRideCode as string, /^\d{4}$/);
    assert.equal("origin" in ride, false);
    assert.equal("destination" in ride, false);
    assert.equal(ride.payId, "driver@example.com");
    assert.equal(ride.payIdType, "EMAIL");
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/co-ride/confirm`,
          "POST",
          { code: ride.coRideCode },
          driverToken,
        )
      ).response.status,
      200,
    );
    const coRide = await json(
      `${base}/api/rides/${driverRide.rideId}`,
      "GET",
      undefined,
      riderToken,
    );
    assert.equal(
      (coRide.body.ride as Record<string, unknown>).payId,
      "driver@example.com",
    );
    assert.equal(
      (
        await json(
          `${base}/api/rides/${driverRide.rideId}/complete`,
          "POST",
          { method: "PAYID" },
          riderToken,
        )
      ).response.status,
      200,
    );
  } finally {
    api.close();
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
