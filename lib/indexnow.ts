import { PUBLIC_SEARCH_PATHS, SITE_URL } from "./seo";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_URL = `${SITE_URL}/indexnow-key.txt`;
const requestOptions = {
  redirect: "error" as const,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; GUMWHEEL-IndexNow/1.0; +https://www.gumwheel.com/about)" },
};

export function indexNowPayload(key: string) {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("Invalid IndexNow ownership key");
  return {
    host: new URL(SITE_URL).host,
    key,
    keyLocation: INDEXNOW_KEY_URL,
    urlList: PUBLIC_SEARCH_PATHS.map(path => new URL(path, SITE_URL).href),
  };
}

/** Explicit CLI use only. No schedules, browser calls, cookies or private URL input. */
export async function submitIndexNow(key: string, fetcher: typeof fetch = fetch) {
  const payload = indexNowPayload(key);
  const proof = await fetcher(INDEXNOW_KEY_URL, { ...requestOptions, signal: AbortSignal.timeout(15_000) });
  if (!proof.ok || (await proof.text()).trim() !== key) throw new Error("The deployed IndexNow key does not match; nothing submitted");
  for (const url of payload.urlList) {
    const page = await fetcher(url, { ...requestOptions, signal: AbortSignal.timeout(15_000) });
    if (page.status !== 200 || !page.headers.get("content-type")?.includes("text/html")) throw new Error(`Public page not ready: ${url}; nothing submitted`);
    const html = await page.text();
    const robots = html.match(/<meta\b[^>]*name=["']robots["'][^>]*>/i)?.[0] ?? "";
    if (/\b(noindex|none)\b/i.test(robots + " " + (page.headers.get("x-robots-tag") ?? ""))) throw new Error(`Public page is not indexable: ${url}; nothing submitted`);
  }
  const response = await fetcher(INDEXNOW_ENDPOINT, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}; do not retry automatically`);
  return {
    submittedAt: new Date().toISOString(),
    endpoint: INDEXNOW_ENDPOINT,
    status: response.status,
    result: response.status === 202 ? "received; ownership validation pending" : "received",
    urls: payload.urlList,
    indexingVerified: false,
  };
}
