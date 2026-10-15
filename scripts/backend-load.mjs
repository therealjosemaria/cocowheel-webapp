// Isolated test tool. Never accepts a target URL, database path or production env.
import { fork } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir, freemem, totalmem, cpus } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { once } from "node:events";

const origin = "http://127.0.0.1";
const percentile = (values, p) =>
  values.length
    ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1]
    : null;

async function worker() {
  // Parent supplies only a newly created directory and synthetic configuration.
  if (!process.send || !process.env.GUMWHEEL_LOAD_DIRECTORY)
    throw new Error("IPC_REQUIRED");
  const directory = process.env.GUMWHEEL_LOAD_DIRECTORY;
  const databasePath = join(directory, "synthetic.sqlite");
  process.env.COCOWHEELS_DB_PATH = databasePath;
  process.env.COCOWHEELS_FRONTEND_ORIGINS = origin;
  process.env.COCOWHEELS_PUBLIC_ORIGIN = origin;
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY =
    randomBytes(32).toString("base64");
  // Fail closed if future API changes attempt email/geocoding/routing requests.
  globalThis.fetch = async () => {
    throw new Error("LOAD_TEST_EXTERNAL_NETWORK_DISABLED");
  };
  const core = await import("../server/core.ts");
  const { default: database } = await import("../server/db.ts");
  const { createApiServer } = await import("../server/index.ts");
  const sqlTimings = {};
  let measuring = false;
  if (process.env.GUMWHEEL_LOAD_PROFILE === "1") {
    const prepare = database.prepare.bind(database);
    database.prepare = (sql) => {
      const statement = prepare(sql);
      const category = sql.startsWith("UPDATE rides SET status = 'EXPIRED'")
        ? "expiry"
        : /^SELECT/i.test(sql.trim())
          ? "select"
          : "write";
      for (const method of ["run", "get", "all"]) {
        const original = statement[method].bind(statement);
        statement[method] = (...parameters) => {
          if (!measuring) return original(...parameters);
          const started = performance.now();
          try {
            return original(...parameters);
          } finally {
            const elapsed = performance.now() - started;
            const metric = (sqlTimings[category] ??= {
              count: 0,
              totalMs: 0,
              maxMs: 0,
            });
            metric.count++;
            metric.totalMs += elapsed;
            metric.maxMs = Math.max(metric.maxMs, elapsed);
          }
        };
      }
      return statement;
    };
  }
  const api = createApiServer(database, { sampleRides: false });
  const actors = [];
  const pin = { latitude: -33.87, longitude: 151.2, label: "Synthetic pickup" };
  const destination = {
    latitude: -33.92,
    longitude: 151.26,
    label: "Synthetic drop-off",
  };
  const account = (name) => {
    const guest = core.createGuestSession(database);
    database
      .prepare("INSERT INTO university_accounts VALUES (?, ?, ?)")
      .run(name, guest.session.id, new Date().toISOString());
    database
      .prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)")
      .run(
        createHash("sha256").update(guest.token).digest("hex"),
        name,
        guest.session.id,
        new Date(Date.now() + 86400000).toISOString(),
      );
    return guest;
  };
  for (let i = 0; i < Number(process.env.GUMWHEEL_LOAD_TRIPS); i++) {
    const driver = account(`load-driver-${i}`),
      rider = account(`load-rider-${i}`);
    const ride = core.publishRide(database, driver.token, {
      origin: pin,
      destination,
      scheduledDepartureAt: new Date().toISOString(),
      priceAud: 5,
      payId: "driver@example.com",
      payIdType: "EMAIL",
    }).ride;
    const request = core.requestRide(database, rider.token, ride.rideId, {
      pickup: pin,
      destination,
      requestedDepartureAt: new Date().toISOString(),
    }).ride.request;
    core.decideRequest(
      database,
      driver.token,
      ride.rideId,
      request.requestId,
      "ACCEPT",
    );
    for (const actor of [driver, rider])
      core.submitLocation(database, actor.token, ride.rideId, {
        ...pin,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
      });
    const code = core.getRide(database, ride.rideId, rider.session).coRideCode;
    core.confirmCoRideCode(database, driver.token, ride.rideId, code);
    if (process.env.GUMWHEEL_LOAD_WORKLOAD === "history") {
      const original = database
        .prepare("SELECT * FROM rides WHERE public_id = ?")
        .get(ride.rideId);
      const originalRequest = database
        .prepare("SELECT * FROM ride_requests WHERE id = ?")
        .get(original.accepted_request_id);
      const insertRow = (table, row) =>
        database
          .prepare(
            `INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.keys(
              row,
            )
              .map(() => "?")
              .join(",")})`,
          )
          .run(...Object.values(row));
      database.transaction(() => {
        for (let h = 0; h < Number(process.env.GUMWHEEL_LOAD_HISTORY); h++) {
          const id = randomUUID(),
            requestId = randomUUID();
          const ended = new Date(Date.now() - (h + 1) * 86400000).toISOString();
          insertRow("rides", {
            ...original,
            id,
            public_id: randomUUID(),
            status: "COMPLETED",
            accepted_request_id: requestId,
            completed_at: ended,
            last_activity_at: ended,
          });
          insertRow("ride_requests", {
            ...originalRequest,
            id: requestId,
            ride_id: id,
          });
        }
      })();
    }
    for (const [role, actor] of [
      ["DRIVER", driver],
      ["RIDER", rider],
    ])
      actors.push({ token: actor.token, rideId: ride.rideId, role });
  }
  if (process.env.GUMWHEEL_LOAD_WORKLOAD === "history") {
    for (let i = 0; i < 20; i++) {
      const driver = account(`load-public-${i}`);
      core.publishRide(database, driver.token, {
        origin: pin,
        destination,
        scheduledDepartureAt: new Date().toISOString(),
        priceAud: 5,
        payId: "driver@example.com",
        payIdType: "EMAIL",
      });
    }
  }
  // Listen only on an OS-assigned loopback port, never on the production port.
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let previousCpu = process.cpuUsage(),
    previousTime = performance.now();
  const metrics = () => {
    const cpu = process.cpuUsage(),
      time = performance.now();
    const result = {
      rssMiB: process.memoryUsage().rss / 1048576,
      cpuPercentOneCore:
        (cpu.user + cpu.system - previousCpu.user - previousCpu.system) /
        ((time - previousTime) * 10),
      eventLoopP99Ms: lag.percentile(99) / 1e6,
      freeSystemMiB: freemem() / 1048576,
      databaseBytes: statSync(databasePath).size,
      walBytes: (() => {
        try {
          return statSync(databasePath + "-wal").size;
        } catch {
          return 0;
        }
      })(),
    };
    previousCpu = cpu;
    previousTime = time;
    lag.reset();
    process.send({ type: "metrics", ...result });
  };
  const timer = setInterval(metrics, 1000);
  const readyAt = new Date().toISOString();
  measuring = true;
  process.send({ type: "ready", port: api.address().port, actors });
  process.on("message", async (message) => {
    if (message !== "stop") return;
    measuring = false;
    clearInterval(timer);
    lag.disable();
    api.close();
    api.closeIdleConnections();
    await once(api, "close");
    const integrity = database.pragma("integrity_check", { simple: true });
    const fixes = database
      .prepare("SELECT COUNT(*) AS count FROM live_locations")
      .get().count;
    const sources = database
      .prepare("SELECT COUNT(*) AS count FROM location_sources")
      .get().count;
    const active = database
      .prepare(
        "SELECT COUNT(*) AS count FROM rides WHERE status = 'CO_RIDE_ACTIVE'",
      )
      .get().count;
    const updatedFixes = database
      .prepare(
        "SELECT COUNT(*) AS count FROM live_locations WHERE received_at > ?",
      )
      .get(readyAt).count;
    database.close();
    process.send({
      type: "finished",
      integrity,
      fixes,
      sources,
      active,
      updatedFixes,
      sqlTimings,
    });
    process.disconnect();
  });
  process.on("disconnect", () => process.exit(0));
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log(
      "Preparation only (no server started).\nSmoke: node --import tsx scripts/backend-load.mjs --smoke\nLoad: node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=5 --seconds=120\nNo target URL or database options are supported. See docs/BACKEND_LOAD_TEST.md.",
    );
    return;
  }
  if (
    args.some(
      (a) =>
        !/^(--smoke|--run|--maintenance-confirmed|--profile|--gps=(synchronized|staggered)|--workload=(polling|history)|--history=\d+|--trips=\d+|--seconds=\d+)$/.test(
          a,
        ),
    )
  )
    throw new Error("UNKNOWN_ARGUMENT");
  if (new Set(args.map((a) => a.split("=")[0])).size !== args.length)
    throw new Error("DUPLICATE_ARGUMENT");
  const smoke = args.includes("--smoke");
  if (smoke && args.length !== 1) throw new Error("SMOKE_HAS_FIXED_LIMITS");
  if (
    !smoke &&
    !(args.includes("--run") && args.includes("--maintenance-confirmed"))
  )
    throw new Error("MAINTENANCE_CONFIRMATION_REQUIRED");
  const numberArg = (name, fallback) =>
    Number(
      args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback,
    );
  const trips = smoke ? 1 : numberArg("trips", 1);
  const seconds = smoke ? 3 : numberArg("seconds", 120);
  const gpsSchedule =
    args.find((a) => a.startsWith("--gps="))?.split("=")[1] ?? "synchronized";
  const profile = args.includes("--profile");
  const workload =
    args.find((a) => a.startsWith("--workload="))?.split("=")[1] ?? "polling";
  const historyDepth = numberArg("history", 20);
  if (
    historyDepth < 1 ||
    historyDepth > 100 ||
    (args.some((a) => a.startsWith("--history=")) && workload !== "history")
  )
    throw new Error("INVALID_HISTORY_DEPTH");
  if (trips < 1 || trips > 250 || seconds < (smoke ? 3 : 30) || seconds > 600)
    throw new Error("OUTSIDE_SAFETY_BOUNDS");
  const directory = mkdtempSync(join(tmpdir(), "gumwheel-backend-load-"));
  const child = fork(fileURLToPath(import.meta.url), [], {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "ignore", "inherit", "ipc"],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      GUMWHEEL_LOAD_WORKER: "1",
      GUMWHEEL_LOAD_DIRECTORY: directory,
      GUMWHEEL_LOAD_TRIPS: String(trips),
      GUMWHEEL_LOAD_PROFILE: profile ? "1" : "0",
      GUMWHEEL_LOAD_WORKLOAD: workload,
      GUMWHEEL_LOAD_HISTORY: String(historyDepth),
    },
  });
  const samples = [],
    responses = [],
    tasks = [];
  let stopped = false,
    failedResponses = 0,
    stopReason = "duration",
    overload = 0,
    final = null,
    ready;
  const stop = (reason) => {
    stopped = true;
    stopReason = reason;
  };
  child.on("message", (message) => {
    if (message.type === "ready") ready = message;
    if (message.type === "finished") final = message;
    if (message.type === "metrics") {
      samples.push({
        ...message,
        generatorRssMiB: process.memoryUsage().rss / 1048576,
      });
      overload =
        message.cpuPercentOneCore > 90 || message.eventLoopP99Ms > 250
          ? overload + 1
          : 0;
      if (message.rssMiB > 512 || message.freeSystemMiB < 512 || overload >= 5)
        stop("resource guardrail");
    }
  });
  child.on("exit", () => {
    if (!final) stop("worker exited unexpectedly");
  });
  const signal = () => stop("interrupted");
  process.on("SIGINT", signal);
  process.on("SIGTERM", signal);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const setupStart = Date.now();
    while (!ready && !stopped && Date.now() - setupStart < 30000)
      await sleep(50);
    if (!ready || stopped) throw new Error("WORKER_NOT_READY");
    if (!Number.isInteger(ready.port) || ready.port === 5060 || ready.port < 1)
      throw new Error("UNSAFE_PORT");
    const base = `http://127.0.0.1:${ready.port}`;
    const start = performance.now(),
      end = start + seconds * 1000;
    for (const [index, actor] of ready.actors.entries()) {
      // Defined reduced workload: current 10s, details 8s, paired GPS 20s/device.
      for (const [kind, period] of workload === "history"
        ? [
            ["history", 10000],
            ["availability", 10000],
          ]
        : [
            ["current", 10000],
            ["details", 8000],
            ["gps", 20000],
          ])
        tasks.push({
          actor,
          kind,
          period,
          due:
            start +
            (smoke
              ? 0
              : kind === "gps"
                ? ((gpsSchedule === "staggered"
                    ? (Math.floor(index / 2) * 997) % 20000
                    : 0) +
                    (actor.role === "DRIVER" ? 10000 : 0)) %
                  20000
                : (index * 997) % period),
          busy: false,
          skipped: 0,
        });
    }
    const request = async (task) => {
      task.busy = true;
      const began = performance.now(),
        scheduledAt = task.due;
      let status = 0,
        valid = false;
      try {
        const path =
          task.kind === "history" || task.kind === "availability"
            ? `/api/${task.kind}`
            : task.kind === "current"
              ? "/api/current"
              : `/api/rides/${encodeURIComponent(task.actor.rideId)}${task.kind === "gps" ? "/location" : ""}`;
        const response = await fetch(base + path, {
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          method: task.kind === "gps" ? "POST" : "GET",
          headers: {
            Origin: origin,
            Authorization: `Bearer ${task.actor.token}`,
            "Content-Type": "application/json",
          },
          ...(task.kind === "gps"
            ? {
                body: JSON.stringify({
                  latitude: -33.87,
                  longitude: 151.2,
                  accuracyMeters: 10,
                  moving: true,
                  capturedAt: new Date().toISOString(),
                }),
              }
            : {}),
        });
        status = response.status;
        const data = await response.json();
        valid =
          response.ok &&
          (task.kind === "history"
            ? Array.isArray(data.driver) &&
              Array.isArray(data.rider) &&
              data[task.actor.role === "DRIVER" ? "driver" : "rider"].length ===
                historyDepth
            : task.kind === "availability"
              ? Array.isArray(data.rides) && data.rides.length === 20
              : task.kind === "current"
                ? data.currents?.some(
                    (c) =>
                      c.ride.rideId === task.actor.rideId &&
                      c.locationSource?.canReport,
                  )
                : data.ride?.rideId === task.actor.rideId &&
                  data.ride.status === "CO_RIDE_ACTIVE");
      } catch {
        /* Record failures without credentials or response bodies. */
      }
      responses.push({
        kind: task.kind,
        status,
        valid: Boolean(valid),
        latencyMs: performance.now() - began,
        startLagMs: began - scheduledAt,
        elapsedMs: began - start,
      });
      task.busy = false;
      if (!valid) failedResponses++;
      if (failedResponses >= 5) stop("five failed responses");
      if (
        responses.length >= 100 &&
        percentile(
          responses.slice(-100).map((r) => r.latencyMs),
          0.95,
        ) > 1000
      )
        stop("rolling p95 above 1s");
    };
    while (!stopped && performance.now() < end) {
      const now = performance.now();
      for (const task of tasks)
        if (now >= task.due) {
          if (task.busy) task.skipped++;
          else void request(task);
          task.due += task.period;
        }
      await sleep(25);
    }
    while (tasks.some((t) => t.busy)) await sleep(25);
    child.send("stop");
    const shutdownStart = Date.now();
    while (!final && Date.now() - shutdownStart < 5000) await sleep(25);
    const summary = Object.fromEntries(
      (workload === "history"
        ? ["history", "availability"]
        : ["current", "details", "gps"]
      ).map((kind) => {
        const list = responses.filter((r) => r.kind === kind),
          times = list.map((r) => r.latencyMs);
        return [
          kind,
          {
            requests: list.length,
            failures: list.filter((r) => !r.valid).length,
            p50Ms: percentile(times, 0.5),
            p95Ms: percentile(times, 0.95),
            p99Ms: percentile(times, 0.99),
            maxMs: times.length ? Math.max(...times) : null,
          },
        ];
      }),
    );
    const report = {
      smoke,
      trips,
      participants: trips * 2,
      seconds,
      gpsSchedule,
      profile,
      workload,
      historyDepth: workload === "history" ? historyDepth : 0,
      elapsedSeconds: (performance.now() - start) / 1000,
      stopReason,
      scheduledSkips: tasks.reduce((s, t) => s + t.skipped, 0),
      clientMaxStartLagMs: responses.length
        ? Math.max(...responses.map((r) => r.startLagMs))
        : null,
      host: { cores: cpus().length, memoryMiB: totalmem() / 1048576 },
      summary,
      windows: Array.from({ length: Math.ceil(seconds / 10) }, (_, index) => {
        const list = responses.filter(
          (r) => Math.floor(r.elapsedMs / 10000) === index,
        );
        return {
          startSeconds: index * 10,
          requests: list.length,
          p95Ms: percentile(
            list.map((r) => r.latencyMs),
            0.95,
          ),
          maxMs: list.length ? Math.max(...list.map((r) => r.latencyMs)) : null,
        };
      }),
      samples,
      final,
      limitations:
        "Reduced loopback workload; generator shares host, providers disabled, fresh synthetic DB. Not production capacity certification.",
    };
    const output = join(directory, "report.json");
    writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(
      JSON.stringify({ report: output, stopReason, summary, final }, null, 2),
    );
    if (
      stopReason !== "duration" ||
      !final ||
      final.integrity !== "ok" ||
      final.active !== trips ||
      final.fixes !== trips * 2 ||
      final.sources !== trips * 2 ||
      final.updatedFixes !== (workload === "history" ? 0 : trips * 2) ||
      responses.some((r) => !r.valid)
    )
      process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", signal);
    process.removeListener("SIGTERM", signal);
    if (child.exitCode === null) child.kill("SIGTERM");
    // Retain the explicitly printed temporary directory for inspection, never production data.
  }
}

(process.env.GUMWHEEL_LOAD_WORKER === "1" ? worker() : main()).catch(() => {
  console.error("Isolated backend test failed; no credentials are printed.");
  process.exitCode = 1;
  if (process.send) process.exit(1);
});
