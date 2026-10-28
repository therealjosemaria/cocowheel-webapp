import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY_URL, indexNowPayload, submitIndexNow } from "../lib/indexnow";

const key = "test-ownership-key-not-a-credential";

test("IndexNow dry run submits nothing and exposes only approved public page URLs", () => {
  const result = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/submit-indexnow.mjs"], { encoding: "utf8" }));
  assert.equal(result.submitted, false);
  assert.equal(result.key, undefined);
  assert.deepEqual(result.urls, ["/", "/help", "/about", "/carpooling/sydney", "/privacy", "/terms"].map(path => new URL(path, "https://www.gumwheel.com").href));
  assert.ok(result.urls.every((url: string) => !new URL(url).search && !new URL(url).hash));
  assert.throws(() => indexNowPayload("bad"));
});

test("IndexNow verifies deployed ownership and pages before one batch, reporting pending verification accurately", async () => {
  const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    calls.push({ url, method: options?.method, body: options?.body });
    if (url === INDEXNOW_KEY_URL) return new Response(key);
    if (url === INDEXNOW_ENDPOINT) return new Response("", { status: 202 });
    return new Response('<html><meta name="robots" content="index, follow"></html>', { headers: { "Content-Type": "text/html" } });
  };
  const result = await submitIndexNow(key, fetcher);
  assert.equal(calls[0].url, INDEXNOW_KEY_URL);
  const posts = calls.filter(call => call.method === "POST");
  assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(String(posts[0].body)), indexNowPayload(key));
  assert.equal(result.status, 202);
  assert.equal(result.result, "received; ownership validation pending");
  assert.equal(result.indexingVerified, false);
});

test("IndexNow ownership mismatch never sends a notification", async () => {
  let calls = 0;
  await assert.rejects(submitIndexNow(key, async () => { calls++; return new Response("wrong-proof"); }), /nothing submitted/);
  assert.equal(calls, 1);
});

test("IndexNow refuses noindex or unavailable public pages before sending", async () => {
  for (const response of [new Response("", { status: 404 }), new Response('<meta name="robots" content="noindex, follow">', { headers: { "Content-Type": "text/html" } })]) {
    let posts = 0;
    const fetcher: typeof fetch = async (input, options) => {
      if (options?.method === "POST") posts++;
      return String(input) === INDEXNOW_KEY_URL ? new Response(key) : response;
    };
    await assert.rejects(submitIndexNow(key, fetcher), /nothing submitted/);
    assert.equal(posts, 0);
  }
});

test("IndexNow rate limiting is reported without an automatic retry", async () => {
  let posts = 0;
  const fetcher: typeof fetch = async (input, options) => {
    if (String(input) === INDEXNOW_KEY_URL) return new Response(key);
    if (options?.method === "POST") { posts++; return new Response("", { status: 429 }); }
    return new Response("<html></html>", { headers: { "Content-Type": "text/html" } });
  };
  await assert.rejects(submitIndexNow(key, fetcher), /HTTP 429/);
  assert.equal(posts, 1);
});
