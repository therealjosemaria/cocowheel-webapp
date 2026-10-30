import { PLATE_ERROR } from "./vehicle";
import { CONTRIBUTION_ERROR } from "./fare";

export const CONNECTION_MESSAGE =
  "We can’t reach the server. Please try again shortly.";
export const API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

export function apiErrorMessage(
  error: unknown,
  fallback = "We couldn’t complete that action. Please try again.",
) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      INVALID_FIXED_PRICE: CONTRIBUTION_ERROR,
      PAYID_REQUIRED: "Enter your PayID to receive a contribution.",
      INVALID_PAYID: "Check your PayID and try again.",
      INVALID_PAYID_TYPE: "Choose Mobile, Email or Other for your PayID.",
      DEMAND_ALREADY_OPEN: "You already have a posted request. Manage it in Activity.",
      DEMAND_CHANGED: "Your post changed. Please review it and try again.",
      DEMAND_UNAVAILABLE: "This request or offer is no longer available. Refresh to see the latest details.",
      DEMAND_NOT_FOUND: "This journey request is no longer available. Open Activity to check your journeys.",
      DEMAND_ROUTE_INCOMPATIBLE: "This rider is outside your route. Try another request.",
      REQUEST_TIME_INCOMPATIBLE: "Choose a departure within the rider’s requested time window.",
      INVALID_REQUEST_TIME: "Choose a valid future date and time, or Any date and Any time.",
      INVALID_DEMAND: "Choose both addresses before continuing.",
      OPEN_ITEM_EXISTS: "You already have an open ride or request. Manage it in Activity first.",
      POSTED_JOURNEY_REPLACEMENT_REQUIRED: "Review replacing your posted journey if this offer is accepted.",
    };
    if (messages[error.code]) return messages[error.code];
  }
  if (error instanceof ApiError && error.code === "INVALID_VEHICLE_PLATE")
    return PLATE_ERROR;
  return error instanceof ApiError && error.code === "SERVICE_UNAVAILABLE"
    ? CONNECTION_MESSAGE
    : error instanceof ApiError && error.code === "INVALID_RESPONSE"
      ? "We couldn’t read the server’s response. Please try again."
      : fallback;
}

let unavailable = false;
let failedAt = 0;
let requestSequence = 0;
const listeners = new Set<() => void>();
export const connectionSnapshot = () => unavailable;
export function subscribeConnection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function report(failed: boolean, started: number) {
  if (typeof window === "undefined") return;
  if (failed) failedAt = requestSequence;
  else if (started <= failedAt) return; // An older response is not recovery evidence.
  unavailable = failed;
  listeners.forEach((listener) => listener());
}

/** One bounded request, including reading the body. Never retries mutations. */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = API_TIMEOUT_MS,
): Promise<T> {
  const started = ++requestSequence;
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const gateway = [502, 503, 504, 520, 521, 522, 523, 524].includes(
      response.status,
    );
    let payload: T & { error?: string; retryAfterSeconds?: number };
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      if (gateway) throw new ApiError("SERVICE_UNAVAILABLE", response.status);
      throw new ApiError(
        response.ok ? "INVALID_RESPONSE" : "REQUEST_FAILED",
        response.status,
      );
    }
    // These structured application errors prove the API responded; email/config
    // failures are not an unreachable server, despite their HTTP 503 status.
    const providerFailure = [
      "EMAIL_NOT_CONFIGURED",
      "EMAIL_SEND_FAILED",
      "ADMIN_NOT_CONFIGURED",
    ].includes(payload?.error ?? "");
    if (gateway && !providerFailure)
      throw new ApiError("SERVICE_UNAVAILABLE", response.status);
    report(false, started);
    if (!response.ok)
      throw new ApiError(payload?.error ?? "REQUEST_FAILED", response.status,
        typeof payload?.retryAfterSeconds === 'number' && Number.isFinite(payload.retryAfterSeconds) && payload.retryAfterSeconds > 0
          ? Math.ceil(payload.retryAfterSeconds) : undefined);
    if (!payload || typeof payload !== "object")
      throw new ApiError("INVALID_RESPONSE", response.status);
    return payload;
  } catch (error) {
    if (init.signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    const failure =
      error instanceof ApiError
        ? error
        : new ApiError("SERVICE_UNAVAILABLE", 0);
    if (failure.code === "SERVICE_UNAVAILABLE") report(true, started);
    throw failure;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}
