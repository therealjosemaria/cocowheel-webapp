export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

const storageKey = "cocowheels:guest-session";
function fallbackToken() {
  return typeof window === "undefined"
    ? null
    : window.sessionStorage.getItem(storageKey);
}

export async function cocowheelsApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = fallbackToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.set("X-Cocowheels-Session-Fallback", "1");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError("SERVICE_UNAVAILABLE", 0);
  }
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    sessionToken?: string | null;
  };
  if (payload.sessionToken && typeof window !== "undefined")
    window.sessionStorage.setItem(storageKey, payload.sessionToken);
  if (!response.ok)
    throw new ApiError(payload.error ?? "REQUEST_FAILED", response.status);
  return payload;
}
