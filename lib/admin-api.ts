import { requestJson } from "./api-transport";
export function adminApi<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(`/api/admin/${path}`, {
    credentials: "same-origin", cache: "no-store", signal,
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Request": "1" }, body: JSON.stringify(body) }),
  });
}
