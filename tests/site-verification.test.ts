import assert from "node:assert/strict";
import test from "node:test";
import { siteVerification } from "../lib/site-verification";

test("owner verification metadata is absent until real provider values are configured", () => {
  assert.equal(siteVerification(), undefined);
  assert.equal(siteVerification(" ", ""), undefined);
});

test("verification token values are trimmed and mapped to their provider metadata", () => {
  assert.deepEqual(siteVerification(" google-token_123 "), { google: "google-token_123" });
  assert.deepEqual(siteVerification(undefined, "AB0123"), { other: { "msvalidate.01": "AB0123" } });
});

test("pasting a complete tag or URL fails clearly without printing the token", () => {
  for (const value of ['<meta content="test">', 'https://example.com/token', 'x'.repeat(513)]) {
    assert.throws(() => siteVerification(value), /only the verification token value/);
  }
});
