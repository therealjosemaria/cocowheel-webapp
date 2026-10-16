// Isolated recovery checks. No production URL/database/environment is accepted.
import assert from "node:assert/strict";
import { execFileSync, fork } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const origin = "http://127.0.0.1";
const here = fileURLToPath(import.meta.url);
const pin = { latitude: -33.87, longitude: 151.2, label: "Synthetic pickup" };
const destination = {
  latitude: -33.92,
  longitude: 151.26,
  label: "Synthetic drop-off",
};

async function worker() {
  if (!process.send || !process.env.GUMWHEEL_RECOVERY_DIRECTORY)
    throw new Error("IPC_REQUIRED");
  process.on("disconnect", () => process.exit(0));
  process.env.COCOWHEELS_DB_PATH = join(
    process.env.GUMWHEEL_RECOVERY_DIRECTORY,
    "synthetic.sqlite",
  );
  process.env.COCOWHEELS_FRONTEND_ORIGINS = origin;
  process.env.COCOWHEELS_PUBLIC_ORIGIN = origin;
  globalThis.fetch = async () => {
    throw new Error("RECOVERY_EXTERNAL_NETWORK_DISABLED");
  };
  const { default: db } = await import("../server/db.ts");
  const core = await import("../server/core.ts");
  const { createApiServer } = await import("../server/index.ts");
  const api = createApiServer(db, {
    sampleRides: false,
    sendUniversityCode: async () => {
      throw new Error("RECOVERY_EMAIL_DISABLED");
    },
  });
  let fault = null;
  api.prependListener("request", (_request, response) => {
    if (!fault) return;
    const mode = fault;
    fault = null;
    const end = response.end;
    response.end = function (...args) {
      if (mode === "lost-response") {
        response.destroy();
        return response;
      }
      if (mode === "kill-after-commit") process.kill(process.pid, "SIGKILL");
      return end.apply(this, args);
    };
  });
  db.function("recovery_crash", () => {
    process.kill(process.pid, "SIGKILL");
  });
  process.on("message", (message) => {
    const { id, action } = message;
    try {
      let result;
      if (action === "actors") {
        result = Array.from({ length: message.count }, (_, index) => {
          const guest = core.createGuestSession(db);
          const name = `recovery-${message.group}-${index}`;
          db.prepare("INSERT INTO university_accounts VALUES (?, ?, ?)").run(
            name,
            guest.session.id,
            new Date().toISOString(),
          );
          db.prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)").run(
            createHash("sha256").update(guest.token).digest("hex"),
            name,
            guest.session.id,
            new Date(Date.now() + 86400000).toISOString(),
          );
          return guest.token;
        });
      } else if (action === "age-code") {
        db.prepare(
          "UPDATE rides SET co_ride_code_issued_at = ? WHERE public_id = ?",
        ).run(new Date(Date.now() - 61000).toISOString(), message.rideId);
        result = true;
      } else if (action === "second-session") {
        const account = db
          .prepare("SELECT * FROM university_sessions WHERE token_hash = ?")
          .get(createHash("sha256").update(message.token).digest("hex"));
        const token = randomBytes(32).toString("base64url");
        db.prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)").run(
          createHash("sha256").update(token).digest("hex"),
          account.unikey,
          account.principal_id,
          account.expires_at,
        );
        result = token;
      } else if (action === "fault") {
        if (message.mode === "kill-in-transaction") {
          assert.match(message.event, /^[A-Z_]+$/);
          db.exec(
            `CREATE TEMP TRIGGER recovery_fault BEFORE INSERT ON ride_events WHEN NEW.event = '${message.event}' BEGIN SELECT recovery_crash(); END`,
          );
        } else fault = message.mode;
        result = true;
      } else if (action === "snapshot") {
        result = {
          rides: db
            .prepare(
              "SELECT public_id,status,accepted_request_id,completed_at,cancelled_at,last_activity_at,co_ride_code_hash,co_ride_code_ciphertext,co_ride_code_issued_at,co_ride_code_attempts FROM rides ORDER BY public_id",
            )
            .all(),
          requests: db
            .prepare("SELECT id,ride_id,status FROM ride_requests ORDER BY id")
            .all(),
          events: db
            .prepare("SELECT ride_id,event,actor FROM ride_events ORDER BY id")
            .all(),
          evidence: db
            .prepare(
              "SELECT ride_id,verified_at,within_250_metres FROM pickup_evidence ORDER BY ride_id",
            )
            .all(),
          locations: db
            .prepare(
              "SELECT ride_id,participant,captured_at,received_at FROM live_locations ORDER BY ride_id,participant",
            )
            .all(),
          sources: db
            .prepare(
              "SELECT ride_id,participant,principal_id,token_hash FROM location_sources ORDER BY ride_id,participant",
            )
            .all(),
          integrity: db.pragma("integrity_check"),
          foreignKeys: db.pragma("foreign_key_check"),
        };
      } else throw new Error("UNKNOWN_COMMAND");
      process.send({ id, result });
    } catch {
      process.send({ id, error: "WORKER_COMMAND_FAILED" });
    }
  });
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  process.send({ ready: true, port: api.address().port });
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "gumwheel-recovery-"));
  let sourceRevision = "unavailable";
  try {
    sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
    }).trim();
  } catch {
    /* Source archives may lack Git metadata. */
  }
  const key = randomBytes(32).toString("base64");
  const checks = [];
  let child,
    base,
    sequence = 0,
    group = 0;
  const rpc = (action, extra = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("IPC_TIMEOUT"));
      }, 10000);
      const receive = (message) => {
        if (message.id !== id) return;
        cleanup();
        if (message.error) reject(new Error(message.error));
        else resolve(message.result);
      };
      const cleanup = () => {
        clearTimeout(timer);
        child.off("message", receive);
      };
      child.on("message", receive);
      child.send({ id, action, ...extra });
    });
  async function start() {
    child = fork(here, ["--worker"], {
      execArgv: ["--import", "tsx"],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        GUMWHEEL_RECOVERY_DIRECTORY: directory,
        COCOWHEELS_CODE_ENCRYPTION_KEY: key,
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("START_TIMEOUT")), 10000);
      child.once("error", reject);
      child.once("exit", () => reject(new Error("START_EXIT")));
      child.on("message", (message) => {
        if (message.ready) {
          clearTimeout(timer);
          resolve(message);
        }
      });
    });
    base = `http://127.0.0.1:${ready.port}`;
  }
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  }
  async function restart() {
    await stop();
    await start();
  }
  async function api(
    path,
    token,
    body,
    method = body === undefined ? "GET" : "POST",
  ) {
    const response = await fetch(`${base}/api/${path}`, {
      method,
      signal: AbortSignal.timeout(5000),
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  }
  const record = (name, details = {}) => {
    checks.push({ name, result: "PASS", ...details });
    console.log(`PASS ${name}`);
  };
  async function state(id, token) {
    const r = await api(`rides/${id}`, token);
    assert.equal(r.status, 200);
    return r.data.ride;
  }
  async function actors() {
    return rpc("actors", { count: 3, group: ++group });
  }
  const offer = () => ({
    origin: pin,
    destination,
    scheduledDepartureAt: new Date().toISOString(),
    priceAud: 5,
    payId: "driver@example.com",
    payIdType: "EMAIL",
  });
  const request = () => ({
    pickup: pin,
    destination,
    requestedDepartureAt: new Date().toISOString(),
  });
  async function setup(stage = "PUBLISHED") {
    const [driver, rider, other] = await actors();
    const published = await api("rides", driver, offer());
    assert.equal(published.status, 201);
    const id = published.data.ride.rideId;
    let requestId;
    if (stage !== "PUBLISHED") {
      const joined = await api(`rides/${id}/requests`, rider, request());
      assert.equal(joined.status, 201);
      requestId = joined.data.ride.request.requestId;
    }
    if (["ACCEPTED", "CO_RIDE_ACTIVE"].includes(stage)) {
      assert.equal(
        (
          await api(
            `rides/${id}/requests/${requestId}`,
            driver,
            { decision: "ACCEPT" },
            "PATCH",
          )
        ).status,
        200,
      );
    }
    if (stage === "CO_RIDE_ACTIVE") {
      const code = (await state(id, rider)).coRideCode;
      assert.equal(
        (await api(`rides/${id}/co-ride/confirm`, driver, { code })).status,
        200,
      );
    }
    return { id, driver, rider, other, requestId };
  }
  async function lost(path, token, body, method, mode = "lost-response") {
    await rpc("fault", { mode });
    await assert.rejects(
      api(path, token, body, method),
      /fetch failed|aborted|terminated/i,
    );
    if (mode === "kill-after-commit") await restart();
  }
  try {
    await start();
    const [driver, rider, outsider] = await actors();
    const publishBody = offer();
    await lost("rides", driver, publishBody);
    await restart();
    const current = await api("current", driver);
    const id = current.data.current.ride.rideId;
    const publishRetry = await api("rides", driver, publishBody);
    assert.equal(publishRetry.data.error, "OPEN_ITEM_EXISTS");
    record("lost publish response + restart: one offer, retry rejected", {
      retry: publishRetry.data.error,
    });
    const joinBody = request();
    await lost(
      `rides/${id}/requests`,
      rider,
      joinBody,
      "POST",
      "kill-after-commit",
    );
    const requested = await state(id, rider);
    const requestId = requested.request.requestId;
    assert.equal(requested.request.status, "PENDING");
    assert.equal(
      (await api(`rides/${id}/requests`, rider, joinBody)).data.error,
      "OPEN_ITEM_EXISTS",
    );
    record("crash after request commit: one request and same session restored");
    await lost(
      `rides/${id}/requests/${requestId}`,
      driver,
      { decision: "ACCEPT" },
      "PATCH",
    );
    const code = (await state(id, rider)).coRideCode;
    assert.match(code, /^\d{4}$/);
    assert.equal((await state(id, rider)).payId, undefined);
    assert.equal((await api(`rides/${id}`, outsider)).status, 403);
    await restart();
    assert.equal((await state(id, rider)).coRideCode, code);
    assert.equal(
      (
        await api(
          `rides/${id}/requests/${requestId}`,
          driver,
          { decision: "ACCEPT" },
          "PATCH",
        )
      ).data.error,
      "REQUEST_UNAVAILABLE",
    );
    record(
      "acceptance and encrypted pickup code survive restart; PayID/access remain private",
    );
    const location = {
      ...pin,
      accuracyMeters: 5,
      moving: false,
      capturedAt: new Date().toISOString(),
    };
    await lost(`rides/${id}/location`, driver, location);
    await restart();
    assert.equal(
      (await state(id, rider)).driverLocation.capturedAt,
      location.capturedAt,
    );
    record("lost GPS response + restart retains the captured timestamp");
    await lost(
      `rides/${id}/co-ride/confirm`,
      driver,
      { code },
      "POST",
      "kill-after-commit",
    );
    assert.equal((await state(id, rider)).status, "CO_RIDE_ACTIVE");
    assert.equal((await state(id, rider)).payId, "driver@example.com");
    assert.equal((await state(id, driver)).status, "CO_RIDE_ACTIVE");
    assert.equal(
      (await api(`rides/${id}/co-ride/confirm`, driver, { code })).data.error,
      "CO_RIDE_CODE_EXPIRED",
    );
    record(
      "crash after pickup: both roles agree, PayID released, code consumed once",
    );
    await lost(`rides/${id}/complete`, rider, { confirmAnyway: true });
    const before = await rpc("snapshot");
    await restart();
    assert.deepEqual(await rpc("snapshot"), before);
    assert.equal(
      (await api(`rides/${id}/complete`, driver, { confirmAnyway: true }))
        .status,
      200,
    );
    assert.deepEqual(await rpc("snapshot"), before);
    for (const token of [driver, rider]) {
      assert.equal((await state(id, token)).status, "COMPLETED");
      assert.equal((await api("current", token)).data.current, null);
      const history = (await api("history", token)).data;
      assert.equal(
        [...history.driver, ...history.rider].filter((r) => r.rideId === id)
          .length,
        1,
      );
    }
    record(
      "completion replay is idempotent; terminal history and pickup evidence survive crash",
    );

    for (const [stage, endpoint, event, body, who, method] of [
      ["PUBLISHED", "requests", "RIDER_REQUESTED", request, "rider", "POST"],
      [
        "REQUESTED",
        "accept",
        "RIDER_ACCEPTED",
        () => ({ decision: "ACCEPT" }),
        "driver",
        "PATCH",
      ],
      ["ACCEPTED", "co-ride/confirm", "CO_RIDE_BEGUN", null, "driver", "POST"],
      [
        "CO_RIDE_ACTIVE",
        "complete",
        "RIDE_COMPLETED_OVERRIDE",
        () => ({ confirmAnyway: true }),
        "rider",
        "POST",
      ],
      [
        "REQUESTED",
        "request/cancel",
        "REQUEST_CANCELLED",
        () => ({}),
        "rider",
        "POST",
      ],
      ["ACCEPTED", "cancel", "RIDE_CANCELLED", () => ({}), "driver", "POST"],
    ]) {
      const scene = await setup(stage);
      const path = `rides/${scene.id}/${endpoint === "accept" ? `requests/${scene.requestId}` : endpoint}`;
      const payload = body
        ? body()
        : { code: (await state(scene.id, scene.rider)).coRideCode };
      const baseline = await rpc("snapshot");
      await rpc("fault", { mode: "kill-in-transaction", event });
      await assert.rejects(
        api(path, scene[who], payload, method),
        /fetch failed|aborted|terminated/i,
      );
      await restart();
      assert.deepEqual(await rpc("snapshot"), baseline);
      assert.ok(
        [200, 201].includes(
          (await api(path, scene[who], payload, method)).status,
        ),
      );
      record(
        `kill inside ${event}: entire transaction rolls back; retry succeeds`,
      );
    }
    const publishActors = await actors();
    const baseline = await rpc("snapshot");
    await rpc("fault", {
      mode: "kill-in-transaction",
      event: "RIDE_PUBLISHED",
    });
    await assert.rejects(
      api("rides", publishActors[0], offer()),
      /fetch failed|aborted|terminated/i,
    );
    await restart();
    assert.deepEqual(await rpc("snapshot"), baseline);
    assert.equal((await api("rides", publishActors[0], offer())).status, 201);
    record(
      "kill inside publication: no partial offer or event; retry succeeds",
    );

    const competition = await setup("REQUESTED");
    const second = await api(
      `rides/${competition.id}/requests`,
      competition.other,
      request(),
    );
    assert.equal(second.status, 201);
    const outcomes = await Promise.all(
      [competition.requestId, second.data.ride.request.requestId].map((rid) =>
        api(
          `rides/${competition.id}/requests/${rid}`,
          competition.driver,
          { decision: "ACCEPT" },
          "PATCH",
        ),
      ),
    );
    assert.equal(outcomes.filter((r) => r.status === 200).length, 1);
    const decided = await state(competition.id, competition.driver);
    assert.equal(
      decided.requests.filter((r) => r.status === "ACCEPTED").length,
      1,
    );
    await restart();
    assert.equal(
      (await state(competition.id, competition.driver)).requests.filter(
        (r) => r.status === "ACCEPTED",
      ).length,
      1,
    );
    record(
      "two concurrent accepts: exactly one rider wins, including after restart",
    );

    for (const [stage, endpoint, who, expectedError] of [
      [
        "REQUESTED",
        "request/cancel",
        "rider",
        "REQUEST_CANCELLATION_NOT_ALLOWED",
      ],
      ["ACCEPTED", "cancel", "driver", "CANCELLATION_NOT_ALLOWED"],
    ]) {
      const scene = await setup(stage);
      await lost(`rides/${scene.id}/${endpoint}`, scene[who], {});
      const saved = await rpc("snapshot");
      await restart();
      assert.equal(
        (await api(`rides/${scene.id}/${endpoint}`, scene[who], {})).data.error,
        expectedError,
      );
      assert.deepEqual(await rpc("snapshot"), saved);
      record(
        `lost ${endpoint} reply: retry rejected without duplicate state/event`,
        { retry: expectedError },
      );
    }

    const simultaneous = await actors();
    const duplicatePublish = await Promise.all([
      api("rides", simultaneous[0], offer()),
      api("rides", simultaneous[0], offer()),
    ]);
    assert.equal(duplicatePublish.filter((r) => r.status === 201).length, 1);
    record("concurrent duplicate publication creates one offer");
    const choices = await Promise.all([setup(), setup()]);
    const duplicateRequest = await Promise.all(
      choices.map((choice) =>
        api(`rides/${choice.id}/requests`, simultaneous[1], request()),
      ),
    );
    assert.equal(duplicateRequest.filter((r) => r.status === 201).length, 1);
    record(
      "concurrent requests to two drivers leave only one active rider request",
    );
    const roleTarget = await setup();
    const roleActors = await actors();
    const roleRace = await Promise.all([
      api("rides", roleActors[0], offer()),
      api(`rides/${roleTarget.id}/requests`, roleActors[0], request()),
    ]);
    assert.equal(roleRace.filter((r) => r.status === 201).length, 1);
    assert.equal((await api("current", roleActors[0])).data.currents.length, 1);
    record(
      "concurrent driver publication and rider request preserve one active role",
    );

    const gps = await setup("ACCEPTED");
    const newer = {
      ...pin,
      accuracyMeters: 5,
      moving: true,
      capturedAt: new Date(Date.now() - 1000).toISOString(),
    };
    assert.equal(
      (await api(`rides/${gps.id}/location`, gps.driver, newer)).status,
      200,
    );
    const gpsSaved = await rpc("snapshot");
    for (const capturedAt of [
      newer.capturedAt,
      new Date(Date.now() - 15000).toISOString(),
    ]) {
      assert.equal(
        (
          await api(`rides/${gps.id}/location`, gps.driver, {
            ...newer,
            capturedAt,
          })
        ).status,
        200,
      );
    }
    assert.deepEqual(await rpc("snapshot"), gpsSaved);
    record(
      "duplicate/out-of-order GPS does not overwrite newer location or receipt time",
    );
    const otherBrowser = await rpc("second-session", { token: gps.driver });
    await restart();
    assert.equal(
      (
        await api(`rides/${gps.id}/location`, otherBrowser, {
          ...newer,
          capturedAt: new Date().toISOString(),
        })
      ).data.error,
      "LOCATION_SOURCE_OTHER_DEVICE",
    );
    const sourceSaved = await rpc("snapshot");
    await rpc("fault", {
      mode: "kill-in-transaction",
      event: "LOCATION_SOURCE_CHANGED",
    });
    await assert.rejects(
      api(`rides/${gps.id}/location-source`, otherBrowser, {}),
      /fetch failed|aborted|terminated/i,
    );
    await restart();
    assert.deepEqual(await rpc("snapshot"), sourceSaved);
    await lost(`rides/${gps.id}/location-source`, otherBrowser, {});
    await restart();
    assert.equal(
      (
        await api(`rides/${gps.id}/location`, gps.driver, {
          ...newer,
          capturedAt: new Date().toISOString(),
        })
      ).data.error,
      "LOCATION_SOURCE_OTHER_DEVICE",
    );
    assert.equal(
      (
        await api(`rides/${gps.id}/location`, otherBrowser, {
          ...newer,
          capturedAt: new Date().toISOString(),
        })
      ).status,
      200,
    );
    record(
      "GPS ownership survives restart; interrupted takeover rolls back; committed takeover persists",
    );

    const renewal = await setup("ACCEPTED");
    await rpc("age-code", { rideId: renewal.id });
    const oldCode = (await state(renewal.id, renewal.rider)).coRideCode;
    await lost(`rides/${renewal.id}/pickup-code`, renewal.rider, {});
    await restart();
    const newCode = (await state(renewal.id, renewal.rider)).coRideCode;
    assert.notEqual(newCode, oldCode);
    assert.equal(
      (await api(`rides/${renewal.id}/pickup-code`, renewal.rider, {})).data
        .error,
      "CO_RIDE_CODE_RATE_LIMITED",
    );
    assert.equal((await state(renewal.id, renewal.rider)).coRideCode, newCode);
    record(
      "lost renewal response: refreshed view recovers new code; immediate retry is throttled",
    );
    await rpc("age-code", { rideId: renewal.id });
    const auditBefore = (await rpc("snapshot")).events.length;
    await rpc("fault", {
      mode: "kill-in-transaction",
      event: "PICKUP_CODE_RENEWED",
    });
    await assert.rejects(
      api(`rides/${renewal.id}/pickup-code`, renewal.rider, {}),
      /fetch failed|aborted|terminated/i,
    );
    await restart();
    const renewalAfter = (await state(renewal.id, renewal.rider)).coRideCode;
    const auditAfter = (await rpc("snapshot")).events.length;
    if (renewalAfter !== newCode && auditAfter === auditBefore) {
      checks.push({
        name: "pickup-code renewal is not atomic with its audit event",
        result: "FINDING",
        consequence:
          "Crash can save a new code without its renewal event; refreshed rider view recovers the code.",
      });
      console.log(
        "FINDING pickup-code renewal is not atomic with its audit event",
      );
    } else {
      assert.equal(renewalAfter, newCode);
      assert.equal(auditAfter, auditBefore);
      record("interrupted pickup-code renewal rolls back atomically");
    }
    const snapshot = await rpc("snapshot");
    assert.deepEqual(snapshot.integrity, [{ integrity_check: "ok" }]);
    assert.deepEqual(snapshot.foreignKeys, []);
    record(
      "SQLite integrity and foreign-key checks pass after all interruptions",
    );
  } catch (error) {
    // Do not serialize request bodies, tokens, codes, GPS or database snapshots.
    checks.push({
      name: "run interrupted",
      result: "FAIL",
      error: error.code ?? error.name,
    });
    console.error(
      error.stack
        ?.split("\n")
        .filter(
          (line) =>
            line.includes("recovery-check") || line.startsWith("Error:"),
        )
        .join("\n") || "Recovery assertion failed; inspect locally.",
    );
    process.exitCode = 1;
  } finally {
    await stop();
    const report = {
      sourceRevision,
      testedAt: new Date().toISOString(),
      runtime: process.version,
      platform: `${process.platform}/${process.arch}`,
      checks,
      passed: checks.every((c) => c.result === "PASS"),
      scope:
        "isolated loopback API + synthetic SQLite; no external providers or live trips",
    };
    writeFileSync(
      join(directory, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(`Report: ${join(directory, "report.json")}`);
    if (!process.exitCode && !report.passed) process.exitCode = 2;
  }
}

if (process.argv[2] === "--worker") await worker();
else if (process.argv.length === 3 && process.argv[2] === "--run") await main();
else if (process.argv.length === 2)
  console.log(
    "Use --run for isolated recovery checks; no server started. Exit 2 means findings; exit 1 means an assertion/harness failure.",
  );
else throw new Error("NO_TARGET_ARGUMENTS_ALLOWED");
