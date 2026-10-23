import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cocowheelsApi } from "../lib/api-client";
import { PLATE_ERROR } from "../lib/vehicle";
import {
  ApiError,
  apiErrorMessage,
  CONNECTION_MESSAGE,
  requestJson,
  connectionSnapshot,
} from "../lib/api-transport";

const originalFetch = globalThis.fetch;
test("backend plate rejection uses the same instruction as frontend validation", async () => {
  globalThis.fetch = async () => Response.json({ error: "INVALID_VEHICLE_PLATE" }, { status: 400 });
  for (const method of ["POST", "PATCH"]) {
    await assert.rejects(requestJson("/api/vehicle", { method }), (error: unknown) =>
      error instanceof ApiError && apiErrorMessage(error, "Generic fallback") === PLATE_ERROR);
  }
  assert.equal(apiErrorMessage(new ApiError("INVALID_VEHICLE", 400), "Check vehicle"), "Check vehicle");
  assert.equal(apiErrorMessage(new ApiError("SERVICE_UNAVAILABLE", 503)), CONNECTION_MESSAGE);
});
test('verification retry metadata survives transport without guessing a wait', async () => {
  for (const value of [55, 780, undefined, -1, '60']) {
    globalThis.fetch = async () => Response.json({error: 'VERIFICATION_RATE_LIMITED', retryAfterSeconds: value}, {status:429});
    await assert.rejects(requestJson('/api/university/code'), (e: unknown) =>
      e instanceof ApiError && e.retryAfterSeconds === (typeof value === 'number' && value > 0 ? value : undefined));
  }
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("shared client preserves credentials, headers and application errors", async () => {
  globalThis.fetch = async (_path, init) => {
    assert.equal(init?.credentials, "include");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.equal(headers.get("X-Cocowheels-Session-Fallback"), "1");
    return Response.json({ error: "CO_RIDE_CODE_INVALID" }, { status: 400 });
  };
  await assert.rejects(
    cocowheelsApi("/api/rides/test/co-ride/confirm", {
      method: "POST",
      body: '{"code":"0000"}',
    }),
    (error: unknown) =>
      error instanceof ApiError && error.code === "CO_RIDE_CODE_INVALID",
  );
});

test("network failure is consistent and never automatically replays writes", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new TypeError("Failed to fetch");
  };
  for (const method of ["GET", "POST", "PATCH"]) {
    await assert.rejects(
      requestJson("/api/rides", { method }),
      (error: unknown) => apiErrorMessage(error) === CONNECTION_MESSAGE,
    );
  }
  assert.equal(calls, 3);
});

test("gateway JSON and HTML use the same message", async () => {
  for (const status of [502, 503, 504, 520, 521, 522, 523, 524]) {
    for (const body of [
      "<html>Unavailable</html>",
      '{"error":"REQUEST_FAILED"}',
    ]) {
      globalThis.fetch = async () => new Response(body, { status });
      await assert.rejects(
        requestJson("/api/current"),
        (error: unknown) => apiErrorMessage(error) === CONNECTION_MESSAGE,
      );
    }
  }
});

test("validation, auth, provider and server errors preserve their identity", async () => {
  for (const [status, code] of [
    [400, "INVALID_UNIKEY"],
    [401, "UNIVERSITY_VERIFICATION_REQUIRED"],
    [403, "FORBIDDEN"],
    [429, "VERIFICATION_RATE_LIMITED"],
    [503, "EMAIL_SEND_FAILED"],
    [503, "EMAIL_NOT_CONFIGURED"],
    [500, "INTERNAL_ERROR"],
  ] as const) {
    globalThis.fetch = async () => Response.json({ error: code }, { status });
    await assert.rejects(
      requestJson("/api/test"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.code === code &&
        error.status === status &&
        apiErrorMessage(error) !== CONNECTION_MESSAGE,
    );
  }
});

test("malformed successful response is not silently accepted", async () => {
  for (const body of ["<html>Oops</html>", "null", '"wrong"']) {
    globalThis.fetch = async () => new Response(body);
    await assert.rejects(
      requestJson("/api/current"),
      (error: unknown) =>
        error instanceof ApiError && error.code === "INVALID_RESPONSE",
    );
  }
});

test("timeout releases a stalled request; caller cancellation stays distinct", async () => {
  globalThis.fetch = (_path, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  await assert.rejects(
    requestJson("/api/current", {}, 10),
    (error: unknown) => apiErrorMessage(error) === CONNECTION_MESSAGE,
  );
  const controller = new AbortController();
  const pending = requestJson("/api/current", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("timeout includes reading a stalled response body", async () => {
  globalThis.fetch = async (_path, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () =>
            controller.error(new DOMException("Aborted", "AbortError")),
          );
        },
      }),
    );
  await assert.rejects(
    requestJson("/api/current", {}, 10),
    (error: unknown) => apiErrorMessage(error) === CONNECTION_MESSAGE,
  );
});

test("browser recovery clears notice even on a valid unauthenticated response", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  try {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await assert.rejects(requestJson("/api/current"));
    assert.equal(connectionSnapshot(), true);
    globalThis.fetch = async () =>
      Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    await assert.rejects(requestJson("/api/university/session"));
    assert.equal(connectionSnapshot(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("an older in-flight response cannot clear a newer connection failure", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  try {
    let resolveOld!: (value: Response) => void;
    globalThis.fetch = () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      });
    const old = requestJson("/api/current");
    await new Promise((resolve) => setTimeout(resolve, 5));
    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    await assert.rejects(requestJson("/api/history"));
    resolveOld(Response.json({ currents: [] }));
    await old;
    assert.equal(connectionSnapshot(), true);
    globalThis.fetch = async () => Response.json({ currents: [] });
    await requestJson("/api/current");
    assert.equal(connectionSnapshot(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
