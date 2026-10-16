// Synthetic-only backup/restore drill. Never accepts a database or target argument.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import {
  copyFileSync,
  constants,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.argv.length !== 3 || process.argv[2] !== "--run") {
  console.log(
    "Usage: node --import tsx scripts/restore-check.mjs --run (synthetic data only)",
  );
  process.exit(process.argv.length === 2 ? 0 : 1);
}
process.umask(0o077);
const directory = mkdtempSync(join(tmpdir(), "gumwheel-restore-"));
// Do not import app code until the environment and default DB are isolated.
for (const name of Object.keys(process.env)) {
  if (!["PATH", "HOME", "LANG", "TZ"].includes(name)) delete process.env[name];
}
process.env.NODE_ENV = "test";
process.env.COCOWHEELS_DB_PATH = join(directory, "source.sqlite");
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.COCOWHEELS_FRONTEND_ORIGINS = "http://127.0.0.1";
process.env.COCOWHEELS_PUBLIC_ORIGIN = "http://127.0.0.1";
const nativeFetch = globalThis.fetch;
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
  runtime: `${process.version} ${process.platform}/${process.arch}`,
  isolation:
    "Synthetic SQLite only; same host; no production DB, env, providers or services",
  checks: [],
  timingsMs: {},
  limitations: [
    "No verified production/off-Pi backup",
    "No production RPO/RTO established",
    "Not a hardware, disk-full, remote transfer or browser test",
    "Small fixture; no writes concurrent with backup; no power loss simulated",
  ],
};
const pass = (name) => {
  report.checks.push({ name, status: "PASS" });
  console.log(`PASS ${name}`);
};
let source, restored, api;
try {
  const { default: db, openDatabase } = await import("../server/db.ts");
  const core = await import("../server/core.ts");
  const { createApiServer } = await import("../server/index.ts");
  source = db;
  core.initializeCoreSchema(source);
  source.pragma("wal_autocheckpoint = 0");
  const now = new Date();
  const actors = Array.from({ length: 7 }, (_, i) => {
    const guest = core.createGuestSession(source, now);
    const name = `restore-fixture-${i}`;
    source
      .prepare("INSERT INTO university_accounts VALUES (?, ?, ?)")
      .run(name, guest.session.id, now.toISOString());
    source
      .prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)")
      .run(
        createHash("sha256").update(guest.token).digest("hex"),
        name,
        guest.session.id,
        new Date(now.getTime() + 86400000).toISOString(),
      );
    return guest.token;
  });
  const origin = {
    latitude: -33.87,
    longitude: 151.2,
    label: "Synthetic pickup",
  };
  const destination = {
    latitude: -33.92,
    longitude: 151.26,
    label: "Synthetic drop-off",
  };
  const offer = {
    origin,
    destination,
    scheduledDepartureAt: now.toISOString(),
    priceAud: 5,
    payId: "driver@example.com",
    payIdType: "EMAIL",
  };
  const request = {
    pickup: origin,
    destination,
    requestedDepartureAt: now.toISOString(),
  };
  const flow = (driver, rider) => {
    const id = core.publishRide(source, driver, offer, now).ride.rideId;
    const asked = core.requestRide(source, rider, id, request, now);
    core.decideRequest(
      source,
      driver,
      id,
      asked.ride.request.requestId,
      "ACCEPT",
      now,
    );
    return id;
  };
  const accepted = flow(actors[0], actors[1]);
  const code = core.getRide(
    source,
    accepted,
    core.findSession(source, actors[1], now),
    now,
  ).coRideCode;
  const completed = flow(actors[2], actors[3]);
  const finishedCode = core.getRide(
    source,
    completed,
    core.findSession(source, actors[3], now),
    now,
  ).coRideCode;
  core.confirmCoRideCode(source, actors[2], completed, finishedCode, now);
  core.completeCoRide(source, actors[3], completed, null, now, true);
  const published = core.publishRide(source, actors[4], offer, now).ride.rideId;
  core.requestRide(source, actors[5], published, request, now);
  core.submitLocation(
    source,
    actors[0],
    accepted,
    {
      ...origin,
      accuracyMeters: 5,
      capturedAt: now.toISOString(),
      moving: false,
    },
    now,
  );
  const snapshot = (database) =>
    Object.fromEntries(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        )
        .all()
        .map(({ name }) => [
          name,
          database
            .prepare(
              `SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`,
            )
            .all(),
        ]),
    );
  const expected = snapshot(source);
  assert.ok(statSync(`${process.env.COCOWHEELS_DB_PATH}-wal`).size > 32);
  pass(
    "Synthetic WAL-backed fixture contains accepted, pending and completed trips, accounts, evidence and GPS",
  );
  const backupPath = join(directory, "backup.sqlite");
  const backupStart = performance.now();
  await source.backup(backupPath);
  report.timingsMs.backup = Math.round(performance.now() - backupStart);
  pass(
    "SQLite online backup succeeds while source connection and WAL remain open",
  );
  // This deliberate post-backup mutation must NOT appear in the restored snapshot.
  core.cancelRide(source, actors[0], accepted, now);
  source.close();
  source = null;
  const restoreStart = performance.now();
  const restorePath = join(directory, "restored.sqlite");
  copyFileSync(backupPath, restorePath, constants.COPYFILE_EXCL);
  restored = openDatabase(restorePath);
  assert.deepEqual(restored.pragma("integrity_check"), [
    { integrity_check: "ok" },
  ]);
  assert.deepEqual(restored.pragma("foreign_key_check"), []);
  assert.deepEqual(snapshot(restored), expected);
  pass(
    "Standalone restored file passes integrity/FK checks and exactly matches every backed-up table",
  );
  assert.equal(
    core.getRide(
      restored,
      accepted,
      core.findSession(restored, actors[1], now),
      now,
    ).status,
    "ACCEPTED",
  );
  pass(
    "Post-backup cancellation is absent: snapshot recovery explicitly loses later changes",
  );
  const correctKey = process.env.COCOWHEELS_CODE_ENCRYPTION_KEY;
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY =
    randomBytes(32).toString("base64");
  try {
    assert.throws(() =>
      core.getRide(
        restored,
        accepted,
        core.findSession(restored, actors[1], now),
        now,
      ),
    );
  } finally {
    process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = correctKey;
  }
  pass(
    "Wrong encryption key cannot recover the pending pickup code; original key is required",
  );
  const options = {
    sampleRides: false,
    sendUniversityCode: async () => {
      throw new Error("EMAIL_DISABLED");
    },
  };
  api = createApiServer(restored, options);
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const url = `http://127.0.0.1:${api.address().port}`;
  const view = async (id, token) => {
    const response = await nativeFetch(`${url}/api/rides/${id}`, {
      headers: { Cookie: `cocowheels_guest=${token}` },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await response.json();
    return { status: response.status, body: payload.ride };
  };
  const rider = await view(accepted, actors[1]);
  assert.equal(rider.status, 200);
  assert.equal(rider.body.coRideCode, code);
  assert.equal(rider.body.payId, undefined);
  assert.equal((await view(accepted, actors[0])).status, 200);
  assert.equal((await view(accepted, actors[6])).status, 403);
  report.timingsMs.restoreThroughAuthenticatedRead = Math.round(
    performance.now() - restoreStart,
  );
  pass(
    "Restored API accepts saved sessions, decrypts pickup code, hides PayID and denies outsider",
  );
  assert.equal((await view(completed, actors[3])).body.status, "COMPLETED");
  pass("Completed trip remains readable after restore");
  core.confirmCoRideCode(restored, actors[0], accepted, code, now);
  assert.equal((await view(accepted, actors[1])).body.payId, offer.payId);
  core.completeCoRide(restored, actors[1], accepted, null, now, true);
  assert.equal((await view(accepted, actors[0])).body.status, "COMPLETED");
  assert.throws(
    () => core.confirmCoRideCode(restored, actors[0], accepted, code, now),
    /CO_RIDE_CODE_EXPIRED/,
  );
  pass(
    "Recovered journey can pair, reveal PayID, complete and reject code reuse",
  );
  assert.deepEqual(restored.pragma("foreign_key_check"), []);
  assert.deepEqual(restored.pragma("integrity_check"), [
    { integrity_check: "ok" },
  ]);
  pass("Restored database remains valid after new lifecycle writes");
} catch (error) {
  // No raw assertion objects: those can include fixture tokens or code plaintext.
  report.checks.push({
    name: "Campaign stopped; inspect locally before claiming success",
    status: "FAIL",
    errorType: error.name,
  });
  console.error(
    `FAIL ${error.name} at ${
      error.stack
        ?.split("\n")
        .find((line) => line.includes("restore-check.mjs:"))
        ?.trim() ?? "unknown location"
    }`,
  );
  process.exitCode = 1;
} finally {
  if (api?.listening) {
    api.closeAllConnections();
    await new Promise((resolve) => api.close(resolve));
  }
  if (source?.open) source.close();
  if (restored?.open) restored.close();
  writeFileSync(
    join(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(`Sanitized report: ${join(directory, "report.json")}`);
}
