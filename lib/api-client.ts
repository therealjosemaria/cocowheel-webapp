import { ApiError, requestJson } from "./api-transport";
export { ApiError, apiErrorMessage, CONNECTION_MESSAGE } from "./api-transport";

const storageKey = "cocowheels:guest-session";
function fallbackToken() {
  try {
    return typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export async function cocowheelsApi<T>(
  path: string,
  init: RequestInit = {},
  verifiedRetry = false,
): Promise<T> {
  const token = fallbackToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.set("X-Cocowheels-Session-Fallback", "1");
  let payload: T & { sessionToken?: string | null };
  try {
    payload = await requestJson(path, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === "UNIVERSITY_VERIFICATION_REQUIRED" &&
      !verifiedRetry &&
      typeof window !== "undefined" &&
      init.method === "POST"
    ) {
      await new Promise<void>((resolve, reject) => {
        window.dispatchEvent(
          new CustomEvent("cocowheels:verify-university", {
            detail: {
              resolve,
              reject: () => reject(new ApiError("VERIFICATION_CANCELLED", 401)),
            },
          }),
        );
      });
      return cocowheelsApi<T>(path, init, true);
    }
    throw error;
  }
  if (payload.sessionToken && typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(storageKey, payload.sessionToken);
    } catch {
      /* Cookies remain available. */
    }
  }
  return payload;
}
