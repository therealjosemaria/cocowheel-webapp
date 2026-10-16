import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/globals.css", "utf8");

test("help keeps rider-first visible role paths with four steps each", () => {
  const help = readFileSync("app/help/page.tsx", "utf8");
  assert.doesNotMatch(help, /Sign in with your UniKey|For University of Sydney students only/);
  const navigation = readFileSync("components/app-navigation.tsx", "utf8");
  assert.match(navigation, /<p>For University of Sydney students only\.<\/p>\s*<button[\s\S]*?Verify UniKey\s*<\/button>/);
  assert.ok(help.indexOf('id="rider-steps-heading"') < help.indexOf('id="driver-steps-heading"'));
  const lists = [...help.matchAll(/<ol className="how-it-works-steps">([\s\S]*?)<\/ol>/g)];
  assert.equal(lists.length, 2);
  assert.match(help, /<RideFieldLabel icon="rider">Find a ride<\/RideFieldLabel>/);
  assert.match(help, /<RideFieldLabel icon="driver">Offer a ride<\/RideFieldLabel>/);
  assert.match(help, /className="help-role help-role-rider"/);
  assert.match(help, /className="help-role help-role-driver"/);
  assert.match(css, /background: color-mix\(in srgb, var\(--help-role-accent\) 6%, var\(--surface\)\);/);
  for (const list of lists) assert.equal((list[1].match(/<li>/g) || []).length, 4);
  const steps = lists.map((list) => [...list[1].matchAll(/<li>([^<]+)<\/li>/g)].map((match) => match[1]));
  assert.match(css, /\.how-it-works-steps\s*\{[^}]*font-weight: var\(--weight-regular\);/);
  assert.match(css, /\.how-it-works-steps li::marker\s*\{[^}]*font-weight: var\(--weight-regular\);/);
  assert.deepEqual(steps, [
    ["Choose your destination.", "Request to join a ride.", "Meet your driver.", "Pay your driver."],
    ["Publish your route.", "Accept a rider.", "Meet your rider.", "Receive payment."],
  ]);
  assert.match(css, /\.help-section h2,\s*\.help-role h2\s*\{/);
  assert.match(css, /\.how-it-works-steps\s*\{[^}]*gap: 8px;/);
  assert.match(css, /\.help-role h2\s*\{[^}]*--icon-label: var\(--icon-field\);/);
  assert.match(css, /\.help-role h2 \.ride-field-label\s*\{\s*gap: 8px;/);
  assert.match(css, /@media \(min-width: 1000px\)\s*\{\s*\.help-role-paths\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("header artwork stays decorative beside the non-clickable brand", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<span className="brand">\s*GUMWHEEL/);
  assert.match(layout, /className="brand-art" aria-hidden="true"/);
  assert.match(layout, /src="\/brand\/gumwheel-bubble-wheel\.png"\s+alt=""/);
  assert.match(css, /\.brand-art\s*\{[^}]*width: 48px;[^}]*height: 32px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*width: 60px;[^}]*height: 30px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*top: 0\.5px;/);
  assert.match(css, /\.brand-art img\s*\{[^}]*transform: scale\(0\.586181640625\);[^}]*transform-origin: 6px center;/);
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
