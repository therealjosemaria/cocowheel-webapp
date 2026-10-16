export const CONNECTION_MESSAGE =
  "We can’t reach the server. Please try again shortly.";
export const API_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export function apiErrorMessage(
  error: unknown,
  fallback = "We couldn’t complete that action. Please try again.",
) {
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
    let payload: T & { error?: string };
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
      throw new ApiError(payload?.error ?? "REQUEST_FAILED", response.status);
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
