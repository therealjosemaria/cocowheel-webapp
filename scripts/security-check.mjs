// Isolated authorization/privacy campaign. No live target or database is accepted.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.argv.length !== 3 || process.argv[2] !== "--run") {
  console.log(
    "Usage: node --import tsx scripts/security-check.mjs --run (synthetic only)",
  );
  process.exit(process.argv.length === 2 ? 0 : 1);
}
process.umask(0o077);
const directory = mkdtempSync(join(tmpdir(), "gumwheel-security-"));
for (const name of Object.keys(process.env))
  if (!["PATH", "HOME", "LANG", "TZ"].includes(name)) delete process.env[name];
process.env.NODE_ENV = "test";
process.env.COCOWHEELS_DB_PATH = join(directory, "synthetic.sqlite");
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const origin = "http://127.0.0.1";
process.env.COCOWHEELS_FRONTEND_ORIGINS = origin;
process.env.COCOWHEELS_PUBLIC_ORIGIN = origin;
const localFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error("EXTERNAL_NETWORK_DISABLED");
};
const report = {
  testedAt: new Date().toISOString(),
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  harnessSha256: createHash("sha256")
    .update(readFileSync(new URL(import.meta.url)))
    .digest("hex"),
  isolation:
    "Synthetic database; loopback real API; in-memory mail; no production env or services",
  checks: [],
  exclusions: [
    "Not a penetration-test certification",
    "No live deployment, browser/XSS, TLS, proxy/cache or provider tests",
    "No capacity claim; concurrency limited to a single API process",
    "Production backups remain deferred",
  ],
};
let db,
  api,
  currentCheck = "startup";
const pass = (name) => {
  report.checks.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const check = async (name, action) => {
  currentCheck = name;
  try {
    await action();
    pass(name);
  } catch {
    report.checks.push({ name, result: "FAIL" });
    console.log(`FAIL ${name}`);
    process.exitCode = 1;
  }
};
try {
  db = (await import("../server/db.ts")).default;
  const core = await import("../server/core.ts");
  const { createApiServer } = await import("../server/index.ts");
  const inbox = new Map();
  api = createApiServer(db, {
    sampleRides: false,
    sendUniversityCode: async (email, code) => {
      inbox.set(email, code);
    },
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const base = `${origin}:${api.address().port}`;
  const call = async (
    path,
    token = "",
    body,
    method = body === undefined ? "GET" : "POST",
    extra = {},
  ) => {
    const response = await localFetch(base + path, {
      method,
      signal: AbortSignal.timeout(5000),
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "X-Cocowheels-Auth": "1",
        ...(token ? { Cookie: `cocowheels_guest=${token}` } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    };
  };
  const login = async (unikey) => {
    const challenge = await call("/api/university/code", "", { unikey });
    assert.equal(challenge.status, 200);
    const email =
      unikey === "guest"
        ? "mosciarobusiness@gmail.com"
        : unikey.includes("@")
          ? unikey
          : `${unikey}@uni.sydney.edu.au`;
    const code = inbox.get(email);
    assert.ok(code);
    assert.ok(!JSON.stringify(challenge.data).includes(code));
    const verified = await call("/api/university/verify", "", {
      challengeId: challenge.data.challengeId,
      code,
    });
    assert.equal(verified.status, 200);
    assert.match(verified.headers.get("set-cookie"), /HttpOnly/);
    assert.match(verified.headers.get("set-cookie"), /SameSite=Strict/);
    assert.equal(verified.data.sessionToken, undefined);
    const token = decodeURIComponent(
      verified.headers.get("set-cookie").split(";")[0].split("=")[1],
    );
    assert.equal(
      (
        await call("/api/university/verify", "", {
          challengeId: challenge.data.challengeId,
          code,
        })
      ).status,
      401,
    );
    return token;
  };
  const driver = await login("driv0001"),
    rider = await login("ride0001"),
    other = await login("ride0002"),
    outsider = await login("else0001");
  const owner = await login("jmos0905"),
    guest = await login("guest"),
    gmail = await login("mosciarobusiness@gmail.com");
  pass(
    "Seven real HTTP OTP logins: cookie flags, no token/code in JSON, single-use OTP",
  );
  await check(
    "Invalid UniKeys/email/header-injection inputs never send mail",
    async () => {
      const before = inbox.size;
      for (const unikey of [
        "test",
        "abcd1234@uni.sydney.edu.au",
        "other@example.com",
        "abcd1234' OR 1=1--",
        "abcd1234\r\nBcc:other@example.com",
        { unikey: "jmos0905" },
      ]) {
        const r = await call("/api/university/code", "", { unikey });
        assert.equal(r.status, 400);
        assert.equal(r.data.error, "INVALID_UNIKEY");
      }
      assert.equal(inbox.size, before);
    },
  );
  await check(
    "OTP requests require explicit auth header and allowed Origin",
    async () => {
      for (const headers of [
        { "X-Cocowheels-Auth": "" },
        { Origin: "https://untrusted.invalid" },
      ]) {
        assert.equal(
          (
            await call(
              "/api/university/code",
              "",
              { unikey: "safe0001" },
              "POST",
              headers,
            )
          ).status,
          403,
        );
      }
      assert.equal(inbox.has("safe0001@uni.sydney.edu.au"), false);
    },
  );
  await check(
    "OTP resend cooldown and five wrong guesses block access",
    async () => {
      const c = await call("/api/university/code", "", { unikey: "lock0001" });
      assert.equal(c.status, 200);
      const code = inbox.get("lock0001@uni.sydney.edu.au");
      assert.equal(
        (await call("/api/university/code", "", { unikey: "lock0001" })).status,
        429,
      );
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await call("/api/university/verify", "", {
              challengeId: c.data.challengeId,
              code: code === "000000" ? "111111" : "000000",
            })
          ).status,
          401,
        );
      assert.equal(
        (
          await call("/api/university/verify", "", {
            challengeId: c.data.challengeId,
            code,
          })
        ).status,
        401,
      );
      assert.equal(
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM university_accounts WHERE unikey = ?",
          )
          .get("lock0001").n,
        0,
      );
    },
  );
  const pin = { latitude: -33.87, longitude: 151.2, label: "Synthetic start" };
  const end = { latitude: -33.92, longitude: 151.26, label: "Synthetic end" };
  const at = new Date().toISOString();
  const offer = {
    origin: pin,
    destination: end,
    scheduledDepartureAt: at,
    priceAud: 5,
    payId: "private-fixture@example.com",
    payIdType: "EMAIL",
  };
  const request = {
    pickup: { ...pin, label: "RIDER_ONE_PRIVATE" },
    destination: end,
    requestedDepartureAt: at,
  };
  const publish = await call("/api/rides", driver, offer);
  assert.equal(publish.status, 201);
  const id = publish.data.ride.rideId;
  const asked = await call(`/api/rides/${id}/requests`, rider, request);
  assert.equal(asked.status, 201);
  const requestId = asked.data.ride.request.requestId;
  const askedOther = await call(`/api/rides/${id}/requests`, other, {
    ...request,
    pickup: { ...pin, label: "RIDER_TWO_PRIVATE" },
  });
  assert.equal(askedOther.status, 201);
  const otherId = askedOther.data.ride.request.requestId;
  const ridePath = `/api/rides/${id}`;
  const snapshot = () =>
    JSON.stringify(
      [
        "rides",
        "ride_requests",
        "ride_events",
        "live_locations",
        "pickup_evidence",
        "location_sources",
      ].map((table) =>
        db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
      ),
    );
  const deny = async (path, token, body, method, extra) => {
    const before = snapshot();
    const result = await call(path, token, body, method, extra);
    assert.ok([400, 401, 403, 404, 409, 429].includes(result.status));
    assert.equal(result.data.ride, undefined);
    assert.equal(snapshot(), before);
  };
  const noPrivate = (value) => {
    const json = JSON.stringify(value);
    for (const text of [
      "private-fixture@example.com",
      "RIDER_ONE_PRIVATE",
      "RIDER_TWO_PRIVATE",
      "coRideCode",
      "co_ride_code_hash",
      "co_ride_code_ciphertext",
      "token_hash",
    ])
      assert.ok(!json.includes(text));
  };
  const legacy = core.createGuestSession(db).token;
  for (const [role, token] of [
    ["anonymous", ""],
    ["forged", "not-a-session"],
    ["legacy", legacy],
  ]) {
    await check(`${role}: cannot publish or request`, async () => {
      await deny("/api/rides", token, offer);
      await deny(`${ridePath}/requests`, token, request);
    });
  }
  for (const [role, token] of [
    ["anonymous", ""],
    ["forged", "not-a-session"],
    ["outsider", outsider],
  ]) {
    await check(`${role}: cannot read participant details`, () =>
      deny(ridePath, token),
    );
  }
  for (const [role, token] of [
    ["anonymous", ""],
    ["rider", rider],
    ["outsider", outsider],
  ]) {
    for (const [action, path, body, method] of [
      [
        "accept",
        `${ridePath}/requests/${requestId}`,
        { decision: "ACCEPT" },
        "PATCH",
      ],
      [
        "decline",
        `${ridePath}/requests/${requestId}`,
        { decision: "DECLINE" },
        "PATCH",
      ],
      [
        "confirm pickup",
        `${ridePath}/co-ride/confirm`,
        { code: "1234" },
        "POST",
      ],
      ["begin", `${ridePath}/begin`, {}, "POST"],
      [
        "GPS",
        `${ridePath}/location`,
        { ...pin, accuracyMeters: 5, capturedAt: at },
        "POST",
      ],
      ["GPS ownership", `${ridePath}/location-source`, {}, "POST"],
      [
        "complete before pickup",
        `${ridePath}/complete`,
        { confirmAnyway: true },
        "POST",
      ],
    ])
      await check(`${role}: rejected ${action} without trip mutation`, () =>
        deny(path, token, body, method),
      );
  }
  await check(
    "outsider cannot cancel or withdraw another ride/request",
    async () => {
      await deny(`${ridePath}/cancel`, outsider, {});
      await deny(`${ridePath}/request/cancel`, outsider, {});
    },
  );
  await check(
    "public discovery and preview omit private rider/payment/code data",
    async () => {
      for (const path of ["/api/availability", `${ridePath}/preview`]) {
        const r = await call(path);
        assert.equal(r.status, 200);
        noPrivate(r.data);
      }
    },
  );
  await check(
    "request-ID tampering never exposes competing rider data",
    async () => {
      const r = await call(`${ridePath}?request=${otherId}`, rider);
      assert.ok(!JSON.stringify(r.data).includes("RIDER_TWO_PRIVATE"));
      assert.ok(
        r.status === 403 ||
          r.status === 404 ||
          (r.status === 200 && r.data.ride.request.requestId === requestId),
      );
    },
  );
  await check(
    "outsider history and current never contain another account ride",
    async () => {
      for (const path of ["/api/history", "/api/current"]) {
        const r = await call(path, outsider);
        assert.equal(r.status, 200);
        assert.ok(!JSON.stringify(r.data).includes(id));
        noPrivate(r.data);
      }
    },
  );
  for (const [role, token] of [
    ["anonymous", ""],
    ["outsider", outsider],
    ["guest", guest],
    ["gmail", gmail],
  ]) {
    await check(`${role}: admin dashboard/inspector blocked`, async () => {
      for (const path of ["/api/admin/dashboard", `/api/admin/rides/${id}`]) {
        const r = await call(path, token);
        assert.equal(r.status, 403);
        noPrivate(r.data);
      }
    });
  }
  await check(
    "verified owner admin access succeeds without payment/code disclosure",
    async () => {
      for (const path of ["/api/admin/dashboard", `/api/admin/rides/${id}`]) {
        const r = await call(path, owner);
        assert.equal(r.status, 200);
        assert.match(r.headers.get("cache-control"), /no-store/);
        assert.ok(!JSON.stringify(r.data).includes(offer.payId));
        assert.ok(!JSON.stringify(r.data).includes("co_ride_code_ciphertext"));
      }
    },
  );
  await check(
    "foreign Origin cannot read private ride or mutate it",
    async () => {
      await deny(ridePath, rider, undefined, "GET", {
        Origin: "https://untrusted.invalid",
      });
      await deny(`${ridePath}/cancel`, driver, {}, "POST", {
        Origin: "https://untrusted.invalid",
      });
    },
  );
  await check("driver cannot self-join or renew rider code", async () => {
    await deny(`${ridePath}/requests`, driver, request);
    await deny(`${ridePath}/pickup-code`, driver, {});
  });
  currentCheck = "accept fixture";
  const accept = await call(
    `${ridePath}/requests/${requestId}`,
    driver,
    { decision: "ACCEPT" },
    "PATCH",
  );
  assert.equal(accept.status, 200);
  const accepted = await call(ridePath, rider);
  const code = accepted.data.ride.coRideCode;
  assert.match(code, /^\d{4}$/);
  await check(
    "accepted rider only gets code; payment stays hidden across details/history/current",
    async () => {
      for (const path of [ridePath, "/api/history", "/api/current"]) {
        const r = await call(path, rider);
        assert.ok(!JSON.stringify(r.data).includes(offer.payId));
      }
      assert.equal(
        (await call(ridePath, driver)).data.ride.coRideCode,
        undefined,
      );
      const rejected = await call(ridePath, other);
      assert.equal(rejected.data.ride.coRideCode, undefined);
      assert.equal(rejected.data.ride.payId, undefined);
    },
  );
  await check(
    "accepted rider cannot self-confirm and driver cannot complete early",
    async () => {
      await deny(`${ridePath}/co-ride/confirm`, rider, { code });
      await deny(`${ridePath}/complete`, driver, { confirmAnyway: true });
    },
  );
  await check(
    "discarded rider cannot cancel accepted ride or take GPS ownership",
    async () => {
      await deny(`${ridePath}/cancel`, other, {});
      await deny(`${ridePath}/location-source`, other, {});
    },
  );
  await check("competing acceptance cannot replace accepted rider", () =>
    deny(
      `${ridePath}/requests/${otherId}`,
      driver,
      { decision: "ACCEPT" },
      "PATCH",
    ),
  );
  currentCheck = "pair fixture";
  assert.equal(
    (await call(`${ridePath}/co-ride/confirm`, driver, { code })).status,
    200,
  );
  await check(
    "only paired rider receives payment; discarded/public viewers do not",
    async () => {
      assert.equal((await call(ridePath, rider)).data.ride.payId, offer.payId);
      assert.equal((await call(ridePath, other)).data.ride.payId, undefined);
      const preview = await call(`${ridePath}/preview`);
      assert.ok(!JSON.stringify(preview.data).includes(offer.payId));
      await deny(ridePath, outsider);
    },
  );
  await check("pickup code replay cannot mutate paired ride", () =>
    deny(`${ridePath}/co-ride/confirm`, driver, { code }),
  );
  await check(
    "logout revokes ride access and writes while preserving trip",
    async () => {
      assert.equal(
        (await call("/api/university/logout", rider, {})).status,
        200,
      );
      await deny(ridePath, rider);
      await deny(`${ridePath}/complete`, rider, { confirmAnyway: true });
      assert.equal(
        (await call(ridePath, driver)).data.ride.status,
        "CO_RIDE_ACTIVE",
      );
    },
  );
  await check(
    "expired owner session loses admin access immediately",
    async () => {
      db.prepare(
        "UPDATE university_sessions SET expires_at = ? WHERE token_hash = ?",
      ).run(
        new Date(Date.now() - 1000).toISOString(),
        createHash("sha256").update(owner).digest("hex"),
      );
      assert.equal((await call("/api/admin/dashboard", owner)).status, 403);
    },
  );
  await check(
    "expired participant session loses private access and mutation authority",
    async () => {
      db.prepare(
        "UPDATE university_sessions SET expires_at = ? WHERE token_hash = ?",
      ).run(
        new Date(Date.now() - 1000).toISOString(),
        createHash("sha256").update(driver).digest("hex"),
      );
      await deny(ridePath, driver);
      await deny(`${ridePath}/cancel`, driver, {});
    },
  );
  await check("SQLite integrity and foreign keys remain valid", async () => {
    assert.deepEqual(db.pragma("integrity_check"), [{ integrity_check: "ok" }]);
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  });
} catch (error) {
  report.checks.push({
    name: `Stopped during ${currentCheck}`,
    result: "FAIL",
    errorType: error.name,
  });
  console.log(`FAIL stopped during ${currentCheck}`);
  process.exitCode = 1;
} finally {
  if (api?.listening) {
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
  }
  if (db?.open) db.close();
  writeFileSync(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(`Sanitized report: ${join(directory, "report.json")}`);
}
