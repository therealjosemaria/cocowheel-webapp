import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/globals.css", "utf8");

test("header artwork stays decorative beside the non-clickable brand", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<span className="brand">\s*GUMWHEEL/);
  assert.match(layout, /className="brand-art" aria-hidden="true"/);
  assert.match(layout, /src="\/brand\/gumwheel-bubble-wheel\.png"\s+alt=""/);
  assert.match(css, /\.brand-art\s*\{[^}]*width: 48px;[^}]*height: 32px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*width: 60px;[^}]*height: 30px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*top: 0\.5px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*transform: scale\(0\.669921875\);[^}]*transform-origin: 6px center;/);
  assert.match(css, /@media \(max-width: 699px\)\s*\{\s*\.brand\s*\{[^}]*\}\s*\.brand-art img\s*\{\s*top: 0;/);
  assert.match(css, /\.brand\s*\{[^}]*gap: 6px;[^}]*padding-right: 18px;/);
  const png = readFileSync("public/brand/gumwheel-bubble-wheel.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png[25], 6, "Artwork should retain its RGBA alpha channel");
});

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
