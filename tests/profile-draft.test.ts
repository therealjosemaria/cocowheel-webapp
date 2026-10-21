import test from "node:test";
import assert from "node:assert/strict";
import {
  readProfileDraft,
  writeProfileDraft,
  clearProfileDraft,
} from "../lib/profile-draft";

test("Profile draft is account-scoped, expires, tolerates unavailable storage and clears on save", () => {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  try {
    const draft = {
      origin: { latitude: -33.8, longitude: 151.2, label: "Sydney" },
      text: { origin: "Sydney", destination: "Univ" },
      days: [1, 3],
      minute: "12:00",
      alerts: false,
    };
    writeProfileDraft("one", draft);
    assert.deepEqual(readProfileDraft("one")?.text, draft.text);
    assert.equal(readProfileDraft("two"), null);
    const key = "cocowheels:profile-route-draft:v1:one";
    values.set(key, JSON.stringify({ ...draft, expiresAt: Date.now() - 1 }));
    assert.equal(readProfileDraft("one"), null);
    values.set(
      key,
      JSON.stringify({ ...draft, days: [8], expiresAt: Date.now() + 1000 }),
    );
    assert.equal(readProfileDraft("one"), null);
    values.set(key, "invalid JSON");
    assert.equal(readProfileDraft("one"), null);
    writeProfileDraft("one", draft);
    clearProfileDraft("one");
    assert.equal(readProfileDraft("one"), null);
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw Error("blocked");
      },
    });
    assert.doesNotThrow(() => writeProfileDraft("one", draft));
    assert.doesNotThrow(() => clearProfileDraft("one"));
    assert.equal(readProfileDraft("one"), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
