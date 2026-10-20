import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public contact links use Gumwheel email without changing the suggestion subject", () => {
  for (const page of ["help", "privacy", "terms"]) {
    const source = readFileSync(`app/${page}/page.tsx`, "utf8");
    const links = [...source.matchAll(/href="(mailto:[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, [page === "help"
      ? "mailto:jose@gumwheel.com?subject=GUMWHEEL%20suggestion"
      : "mailto:jose@gumwheel.com"]);
    assert.ok(!source.includes("jmos0905@uni.sydney.edu.au"));
    if (page !== "help") assert.match(source, />\s*jose@gumwheel\.com\s*<\/a>/);
  }
});
