// Opt-in synthetic mixed workload. Never accepts a live target/database.
import { fork, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync, statfsSync } from "node:fs";
import { freemem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  monitorEventLoopDelay,
  PerformanceObserver,
  performance,
} from "node:perf_hooks";
import assert from "node:assert/strict";
const here = fileURLToPath(import.meta.url),
  origin = "http://127.0.0.1";
const pin = { latitude: -33.87, longitude: 151.2, label: "Synthetic pickup" };
const destination = {
  latitude: -33.92,
  longitude: 151.26,
  label: "Synthetic destination",
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pct = (a, p) =>
  a.length ? [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1] : null;
async function worker() {
  if (!process.send || !process.env.MIXED_DIRECTORY)
    throw new Error("IPC_REQUIRED");
  process.on("disconnect", () => process.exit(0));
  process.env.COCOWHEELS_DB_PATH = join(
    process.env.MIXED_DIRECTORY,
    "synthetic.sqlite",
  );
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY =
    randomBytes(32).toString("base64");
  process.env.COCOWHEELS_FRONTEND_ORIGINS = origin;
  process.env.COCOWHEELS_PUBLIC_ORIGIN = origin;
  globalThis.fetch = () => {
    throw new Error("PROVIDERS_DISABLED");
  };
  const { default: db } = await import("../server/db.ts");
  const core = await import("../server/core.ts");
  const { createApiServer } = await import("../server/index.ts");
  const diagnostics = process.env.MIXED_DIAGNOSTICS === "1";
  let sqlMaxMs = 0,
    sqlTotalMs = 0,
    sqlCount = 0,
    slowSql = [],
    slowTransactions = [],
    gcEvents = [];
  const observer = diagnostics
    ? new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          gcEvents.push({
            startMs: e.startTime,
            durationMs: e.duration,
            kind: e.detail.kind,
          });
      })
    : null;
  observer?.observe({ entryTypes: ["gc"] });
  if (diagnostics) {
    const prepare = db.prepare.bind(db);
    db.prepare = (sql) => {
      const statement = prepare(sql);
      for (const method of ["get", "all", "run"]) {
        const original = statement[method].bind(statement);
        statement[method] = (...parameters) => {
          const startMs = performance.now();
          try {
            return original(...parameters);
          } finally {
            const durationMs = performance.now() - startMs;
            sqlCount++;
            sqlTotalMs += durationMs;
            sqlMaxMs = Math.max(sqlMaxMs, durationMs);
            if (durationMs >= 20 && slowSql.length < 100)
              slowSql.push({
                startMs,
                durationMs,
                method,
                verb: sql.trim().split(/\s+/)[0].toUpperCase(),
              });
          }
        };
      }
      return statement;
    };
    // better-sqlite3 prepares COMMIT internally, bypassing the public prepare.
    // Time the callback separately from the complete transaction wrapper.
    const transaction = db.transaction.bind(db);
    db.transaction = (fn) => {
      let callbackMs = 0;
      const wrapped = transaction(function (...args) {
        const start = performance.now();
        try {
          return fn.apply(this, args);
        } finally {
          callbackMs = performance.now() - start;
        }
      });
      const measure = (execute) =>
        function (...args) {
          const startMs = performance.now();
          callbackMs = 0;
          try {
            return execute.apply(this, args);
          } finally {
            const durationMs = performance.now() - startMs;
            if (durationMs >= 20 && slowTransactions.length < 100)
              slowTransactions.push({
                startMs,
                durationMs,
                callbackMs,
                boundaryMs: durationMs - callbackMs,
              });
          }
        };
      const result = measure(wrapped);
      for (const mode of ["default", "deferred", "immediate", "exclusive"])
        result[mode] = measure(wrapped[mode]);
      result.database = db;
      return result;
    };
  }
  const procNumbers = (path, pattern) => {
    try {
      const text = readFileSync(path, "utf8");
      return pattern
        ? Number(text.match(pattern)?.[1] ?? 0)
        : text.trim().split(/\s+/).map(Number);
    } catch {
      return null;
    }
  };
  const api = createApiServer(db, {
    sampleRides: false,
    sendUniversityCode: async () => {
      throw new Error("EMAIL_DISABLED");
    },
  });
  const actors = Array.from(
    { length: Number(process.env.MIXED_USERS) },
    (_, i) => {
      const a = core.createGuestSession(db),
        name = `mixed-${i}`;
      db.prepare("INSERT INTO university_accounts VALUES (?, ?, ?)").run(
        name,
        a.session.id,
        new Date().toISOString(),
      );
      db.prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)").run(
        createHash("sha256").update(a.token).digest("hex"),
        name,
        a.session.id,
        new Date(Date.now() + 86400000).toISOString(),
      );
      return { token: a.token, name };
    },
  );
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let cpu = process.cpuUsage(),
    time = performance.now();
  let resource = process.resourceUsage(),
    sched = diagnostics ? procNumbers("/proc/self/schedstat") : null;
  let utilization = performance.eventLoopUtilization();
  sqlMaxMs = 0;
  sqlTotalMs = 0;
  sqlCount = 0;
  slowSql = [];
  slowTransactions = [];
  gcEvents = [];
  const timer = setInterval(() => {
    const next = process.cpuUsage(),
      now = performance.now();
    const nextResource = process.resourceUsage(),
      nextSched = diagnostics ? procNumbers("/proc/self/schedstat") : null;
    const nextUtilization = performance.eventLoopUtilization();
    process.send({
      type: "metrics",
      at: new Date().toISOString(),
      rssMiB: process.memoryUsage().rss / 1048576,
      cpu:
        (next.user + next.system - cpu.user - cpu.system) / ((now - time) * 10),
      lagMs: lag.percentile(99) / 1e6,
      freeMiB: freemem() / 1048576,
      ...(diagnostics
        ? {
            diagnostics: {
              workerMs: now,
              intervalMs: now - time,
              eventLoopUtilization: performance.eventLoopUtilization(
                nextUtilization,
                utilization,
              ).utilization,
              sqlCount,
              sqlTotalMs,
              sqlMaxMs,
              slowSql,
              slowTransactions,
              gcEvents,
              involuntaryContextSwitches:
                nextResource.involuntaryContextSwitches -
                resource.involuntaryContextSwitches,
              fsRead: nextResource.fsRead - resource.fsRead,
              fsWrite: nextResource.fsWrite - resource.fsWrite,
              schedulerWaitMs:
                sched && nextSched ? (nextSched[1] - sched[1]) / 1e6 : null,
              hostSwapInPages: procNumbers("/proc/vmstat", /^pswpin\s+(\d+)/m),
              hostSwapOutPages: procNumbers(
                "/proc/vmstat",
                /^pswpout\s+(\d+)/m,
              ),
            },
          }
        : {}),
    });
    cpu = next;
    time = now;
    resource = nextResource;
    sched = nextSched;
    utilization = nextUtilization;
    sqlMaxMs = 0;
    sqlTotalMs = 0;
    sqlCount = 0;
    slowSql = [];
    slowTransactions = [];
    gcEvents = [];
    lag.reset();
  }, 1000);
  process.send({ type: "ready", port: api.address().port, actors });
  process.on("message", async (message) => {
    if (message !== "stop") return;
    clearInterval(timer);
    lag.disable();
    observer?.disconnect();
    api.closeAllConnections();
    await new Promise((r) => api.close(r));
    const final = {
      integrity: db.pragma("integrity_check", { simple: true }),
      journalMode: db.pragma("journal_mode", { simple: true }),
      synchronous: db.pragma("synchronous", { simple: true }),
      foreignKeyViolations: db.pragma("foreign_key_check").length,
      statuses: db
        .prepare("SELECT status,count(*) AS count FROM rides GROUP BY status")
        .all(),
      acceptedDuplicates: db
        .prepare(
          "SELECT count(*) AS count FROM (SELECT ride_id FROM ride_requests WHERE status='ACCEPTED' GROUP BY ride_id HAVING count(*)>1)",
        )
        .get().count,
      paired: db.prepare("SELECT count(*) AS count FROM pickup_evidence").get()
        .count,
    };
    db.close();
    process.send({ type: "finished", final });
    process.disconnect();
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(
      "No load started. --run --maintenance-confirmed --users=25 --seconds=120 (synthetic only)",
    );
    return;
  }
  if (
    args.length !== (args.includes("--diagnostics") ? 5 : 4) ||
    !args.includes("--run") ||
    !args.includes("--maintenance-confirmed") ||
    args.some(
      (a) =>
        !/^--(run|maintenance-confirmed|diagnostics|users=\d+|seconds=\d+)$/.test(
          a,
        ),
    ) ||
    new Set(args.map((a) => a.split("=")[0])).size !== args.length
  )
    throw new Error("INVALID_ARGUMENTS");
  const users = Number(
      args.find((a) => a.startsWith("--users=")).split("=")[1],
    ),
    seconds = Number(
      args.find((a) => a.startsWith("--seconds=")).split("=")[1],
    );
  if (![4, 25, 50, 100].includes(users) || seconds < 30 || seconds > 600)
    throw new Error("UNSAFE_BOUNDS");
  process.umask(0o077);
  // Same filesystem as the application's default data directory, never its DB.
  // /tmp is tmpfs on the Pi and would underrepresent storage latency.
  const directory = mkdtempSync(
    join(fileURLToPath(new URL("../data/", import.meta.url)), ".mixed-load-"),
  );
  const child = fork(here, ["--worker"], {
    execArgv: ["--import", "tsx"],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      MIXED_DIRECTORY: directory,
      MIXED_USERS: String(users),
      MIXED_DIAGNOSTICS: args.includes("--diagnostics") ? "1" : "0",
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const samples = [],
    results = [],
    tasks = [],
    pairs = [],
    pending = new Set();
  let ready,
    final,
    stopped = false,
    reason = "duration",
    overload = 0,
    failures = 0,
    skips = 0,
    maxLag = 0,
    completed = 0,
    published = 0,
    paired = 0,
    start;
  const stop = (r) => {
    if (!stopped) {
      stopped = true;
      reason = r;
    }
  };
  process.on("SIGINT", () => stop("interrupted"));
  process.on("SIGTERM", () => stop("interrupted"));
  child.on("exit", () => {
    if (!final) stop("worker exit");
  });
  child.on("message", (m) => {
    if (m.type === "ready") ready = m;
    if (m.type === "finished") final = m.final;
    if (m.type === "metrics") {
      samples.push({
        ...m,
        generatorRssMiB: process.memoryUsage().rss / 1048576,
      });
      overload = m.cpu > 90 || m.lagMs > 250 ? overload + 1 : 0;
      const disk = statfsSync(directory);
      if (
        m.rssMiB > 512 ||
        m.freeMiB < 512 ||
        overload >= 5 ||
        disk.bavail * disk.bsize < 256 * 1048576
      )
        stop("resource guardrail");
    }
  });
  try {
    const deadline = Date.now() + 30000;
    while (!ready && !stopped && Date.now() < deadline) await sleep(25);
    assert.ok(ready && !stopped, "STARTUP_FAILED");
    const base = `${origin}:${ready.port}`;
    const request = async (
      kind,
      path,
      actor,
      body,
      method = body === undefined ? "GET" : "POST",
      valid = () => true,
    ) => {
      const began = performance.now();
      let ok = false,
        status = 0,
        data;
      try {
        const r = await fetch(base + path, {
          method,
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          headers: {
            Origin: origin,
            Authorization: `Bearer ${actor.token}`,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        status = r.status;
        data = await r.json();
        ok = r.ok && valid(data);
      } catch {}
      results.push({
        kind,
        status,
        ok,
        ms: performance.now() - began,
        second: Math.floor((began - start) / 1000),
      });
      if (!ok) {
        failures++;
        if (failures >= 5) stop("five failures");
        throw new Error("REQUEST_FAILED");
      }
      const recent = results.slice(-100);
      if (
        recent.length === 100 &&
        pct(
          recent.map((r) => r.ms),
          0.95,
        ) > 1000
      )
        stop("rolling latency guardrail");
      return data;
    };
    start = performance.now();
    const pairCount = Math.floor(users / 4);
    for (let i = 0; i < pairCount; i++)
      pairs.push({
        driver: ready.actors[i * 2],
        rider: ready.actors[i * 2 + 1],
        phase: 0,
        due: start + i * 1000,
        id: null,
        busy: false,
      });
    const add = (period, phase, run) =>
      tasks.push({ period, due: start + phase, run, busy: false });
    ready.actors.forEach((a, i) => {
      add(10000, (i * 307) % 10000, () =>
        request("current", "/api/current", a, undefined, "GET", (d) =>
          Array.isArray(d.currents),
        ),
      );
      add(30000, (i * 613) % 30000, () =>
        request(
          "history",
          "/api/history",
          a,
          undefined,
          "GET",
          (d) => Array.isArray(d.driver) && Array.isArray(d.rider),
        ),
      );
      add(30000, (i * 719) % 30000, () =>
        request(
          "session",
          "/api/university/session",
          a,
          undefined,
          "GET",
          (d) => d.unikey === a.name,
        ),
      );
      if (i >= pairCount * 2) {
        add(10000, (i * 503) % 10000, () =>
          request(
            "availability",
            "/api/availability",
            a,
            undefined,
            "GET",
            (d) => Array.isArray(d.rides),
          ),
        );
        add(20000, (i * 827) % 20000, () =>
          request(
            "search",
            "/api/search",
            a,
            {
              pickup: pin,
              destination,
              requestedDepartureAt: new Date().toISOString(),
            },
            "POST",
            (d) => Array.isArray(d.candidates),
          ),
        );
      }
    });
    for (const [i, p] of pairs.entries()) {
      for (const [role, a] of [
        ["driver", p.driver],
        ["rider", p.rider],
      ]) {
        add(8000, (i * 431 + (role === "driver" ? 0 : 3000)) % 8000, () =>
          p.id
            ? request(
                "details",
                `/api/rides/${p.id}`,
                a,
                undefined,
                "GET",
                (d) => d.ride?.rideId === p.id,
              )
            : Promise.resolve(),
        );
        add(20000, (i * 997 + (role === "driver" ? 10000 : 0)) % 20000, () =>
          p.id && p.phase >= 3 && p.phase <= 4
            ? request(
                "gps",
                `/api/rides/${p.id}/location`,
                a,
                {
                  ...pin,
                  accuracyMeters: 5,
                  moving: true,
                  capturedAt: new Date().toISOString(),
                },
                "POST",
                (d) => d.ride?.rideId === p.id,
              )
            : Promise.resolve(),
        );
      }
      // Rider details are unavailable until a request exists; gate the generic read.
      const riderDetails = tasks[tasks.length - 2];
      const original = riderDetails.run;
      riderDetails.run = () => (p.phase >= 2 ? original() : Promise.resolve());
      p.run = async () => {
        const route = () => `/api/rides/${p.id}`;
        if (p.phase === 0) {
          const d = await request(
            "publish",
            "/api/rides",
            p.driver,
            {
              origin: pin,
              destination,
              scheduledDepartureAt: new Date().toISOString(),
              priceAud: 5,
              payId: "driver@example.com",
              payIdType: "EMAIL",
            },
            "POST",
            (d) => Boolean(d.ride?.rideId),
          );
          p.id = d.ride.rideId;
          published++;
        } else if (p.phase === 1) {
          const d = await request(
            "join",
            route() + "/requests",
            p.rider,
            {
              pickup: pin,
              destination,
              requestedDepartureAt: new Date().toISOString(),
            },
            "POST",
            (d) => d.ride?.request?.status === "PENDING",
          );
          p.requestId = d.ride.request.requestId;
        } else if (p.phase === 2) {
          await request(
            "accept",
            route() + "/requests/" + p.requestId,
            p.driver,
            { decision: "ACCEPT", plate: "TEST123" },
            "PATCH",
            (d) => d.ride?.status === "ACCEPTED",
          );
        } else if (p.phase === 3) {
          const d = await request(
            "pickup-code-read",
            route(),
            p.rider,
            undefined,
            "GET",
            (d) =>
              /^\d{4}$/.test(d.ride?.coRideCode) && d.ride.payId === undefined,
          );
          await request(
            "pair",
            route() + "/co-ride/confirm",
            p.driver,
            { code: d.ride.coRideCode },
            "POST",
            (d) => d.ride?.status === "CO_RIDE_ACTIVE",
          );
          paired++;
        } else if (p.phase === 4) {
          await request(
            "complete",
            route() + "/complete",
            p.rider,
            { confirmAnyway: true },
            "POST",
            (d) => d.ride?.status === "COMPLETED",
          );
          completed++;
        } else {
          const old = p.id;
          await request(
            "history-after-complete",
            "/api/history",
            p.rider,
            undefined,
            "GET",
            (d) =>
              d.rider?.some((r) => r.rideId === old || r.ride?.rideId === old),
          );
          p.id = null;
        }
        const delays = [5000, 5000, 5000, 55000, 5000, 15000];
        p.due = performance.now() + delays[p.phase];
        p.phase = (p.phase + 1) % 6;
      };
    }
    const launch = (t) => {
      t.busy = true;
      const promise = t
        .run()
        .catch(() => {})
        .finally(() => {
          t.busy = false;
          pending.delete(promise);
        });
      pending.add(promise);
    };
    let nextProgress = start + 30000;
    while (!stopped && performance.now() < start + seconds * 1000) {
      const now = performance.now();
      if (now >= nextProgress) {
        const latest = samples.at(-1);
        console.log(
          JSON.stringify({
            elapsedSeconds: Math.round((now - start) / 1000),
            requests: results.length,
            failures,
            skips,
            completed,
            apiRssMiB: latest?.rssMiB,
            cpu: latest?.cpu,
          }),
        );
        nextProgress += 30000;
      }
      for (const t of tasks)
        if (now >= t.due) {
          maxLag = Math.max(maxLag, now - t.due);
          t.due += t.period;
          if (t.busy) skips++;
          else launch(t);
        }
      for (const p of pairs) if (now >= p.due && !p.busy) launch(p);
      await sleep(20);
    }
    await Promise.allSettled([...pending]);
  } catch {
    stop("harness/setup failure");
  } finally {
    if (child.connected) child.send("stop");
    const deadline = Date.now() + 10000;
    while (!final && Date.now() < deadline) await sleep(25);
    if (!final) child.kill("SIGKILL");
    const metrics = Object.fromEntries(
      [...new Set(results.map((r) => r.kind))].map((kind) => {
        const rows = results.filter((r) => r.kind === kind),
          times = rows.map((r) => r.ms);
        return [
          kind,
          {
            count: rows.length,
            failures: rows.filter((r) => !r.ok).length,
            p50: pct(times, 0.5),
            p95: pct(times, 0.95),
            p99: pct(times, 0.99),
            max: Math.max(...times),
            goodWithin500ms: rows.filter((r) => r.ok && r.ms <= 500).length,
            goodWithin1000ms: rows.filter((r) => r.ok && r.ms <= 1000).length,
          },
        ];
      }),
    );
    const passed =
      reason === "duration" &&
      failures === 0 &&
      skips === 0 &&
      completed > 0 &&
      final?.integrity === "ok" &&
      final.foreignKeyViolations === 0 &&
      final.acceptedDuplicates === 0 &&
      final.paired === paired &&
      final.statuses.reduce((sum, row) => sum + row.count, 0) === published &&
      (final.statuses.find((row) => row.status === "COMPLETED")?.count ?? 0) ===
        completed;
    const report = {
      at: new Date().toISOString(),
      sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      storage:
        "private fixture under project data directory; production filesystem, not production database",
      harnessSha256: createHash("sha256")
        .update(readFileSync(here))
        .digest("hex"),
      users,
      pairs: pairs.length,
      browsers: users - pairs.length * 2,
      seconds,
      elapsedSeconds: start ? (performance.now() - start) / 1000 : 0,
      passed,
      reason,
      failures,
      skips,
      maxSchedulerLagMs: maxLag,
      published,
      paired,
      completed,
      metrics,
      diagnosticsEnabled: args.includes("--diagnostics"),
      slowResponses: args.includes("--diagnostics")
        ? results.filter((r) => r.ms >= 50)
        : undefined,
      samples,
      final,
      scope:
        "Synthetic mixed core API; no providers, real browsers, TLS/tunnel or mature historical dataset",
    };
    writeFileSync(
      join(directory, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        passed,
        reason,
        users,
        requests: results.length,
        failures,
        skips,
        completed,
        report: join(directory, "report.json"),
      }),
    );
    if (!passed) process.exitCode = 1;
  }
}
if (process.argv[2] === "--worker") {
  await worker();
} else {
  await main().catch(() => {
    console.error("Invalid configuration; no load started");
    process.exitCode = 1;
  });
}
