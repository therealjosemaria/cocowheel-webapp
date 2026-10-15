import assert from "node:assert/strict";
import test from "node:test";
import { sendUniversityEmail } from "../server/university-auth";

test("verification email rebrands display text without changing delivery settings", async (t) => {
  const previousKey = process.env.COCOWHEELS_RESEND_API_KEY;
  const previousFrom = process.env.COCOWHEELS_EMAIL_FROM;
  process.env.COCOWHEELS_RESEND_API_KEY = "test-key";
  t.after(() => {
    for (const [key, value] of [
      ["COCOWHEELS_RESEND_API_KEY", previousKey],
      ["COCOWHEELS_EMAIL_FROM", previousFrom],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let payload: Record<string, unknown> = {};
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init: RequestInit) => {
      payload = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    },
  );
  for (const [from, expected] of [
    [
      "Cocowheels <cocowheels@example.com>",
      "GUMWHEEL <cocowheels@example.com>",
    ],
    [
      '"Coco Wheels" <cocowheels@example.com>',
      "GUMWHEEL <cocowheels@example.com>",
    ],
    ["cocowheels@example.com", "cocowheels@example.com"],
  ]) {
    process.env.COCOWHEELS_EMAIL_FROM = from;
    await sendUniversityEmail("student@example.com", "123456");
    assert.equal(payload.from, expected);
    assert.deepEqual(payload.to, ["student@example.com"]);
    assert.equal(payload.subject, "Your GUMWHEEL verification code");
    assert.match(String(payload.text), /Your GUMWHEEL code is 123456/);
    assert.match(String(payload.text), /expires in 10 minutes/);
  }
});
