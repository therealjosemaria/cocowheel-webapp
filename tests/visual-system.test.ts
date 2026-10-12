import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/globals.css", "utf8");

test("font sizes use the documented shared scale", () => {
  const sizes = [...css.matchAll(/font-size:\s*([^;\n}]+)/g)];
  assert.ok(sizes.length > 50);
  for (const [, value] of sizes) {
    assert.match(value.trim(), /^var\(--text-[a-z-]+\)(?:\s*!important)?$/);
    const token = value.match(/--text-[a-z-]+/)![0];
    assert.ok(css.includes(`${token}:`), `Undefined token ${token}`);
  }
});

test("weights and explicit families use shared tokens", () => {
  assert.doesNotMatch(css, /font-weight:\s*\d/);
  assert.doesNotMatch(css, /font-family:\s*(?:Arial|Helvetica)/);
});

test("fare and PayID labels share the same semantic styling", () => {
  assert.match(css, /\.field, \.payid-field legend\s*\{[^}]*font-size: var\(--text-small\);[^}]*font-weight: var\(--weight-bold\)/);
});
