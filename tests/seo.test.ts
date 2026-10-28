import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { homePageMetadata, publicPageMetadata, SITE_URL } from "../lib/seo";

test("search discovery lists only the public information pages on the canonical domain", () => {
  assert.deepEqual(sitemap().map(item => item.url), ["/", "/help", "/privacy", "/terms"].map(path => new URL(path, SITE_URL).href));
  assert.deepEqual(robots(), { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` });
});

test("public metadata uses clean canonical/share URLs and explicitly allows indexing", () => {
  const metadata = publicPageMetadata("/help", "Help", "How sharing works");
  assert.deepEqual(metadata.alternates, { canonical: `${SITE_URL}/help` });
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal(metadata.openGraph?.url, `${SITE_URL}/help`);
});

test("email matching entries never expose their key through search metadata", () => {
  for (const match of ["private-test-key", ["", "private-test-key"]]) {
    const metadata = homePageMetadata(match);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.equal(metadata.alternates, undefined);
    assert.equal(metadata.openGraph, undefined);
    assert.equal(JSON.stringify(metadata).includes("private-test-key"), false);
  }
  assert.deepEqual(homePageMetadata(undefined).robots, { index: true, follow: true });
  assert.deepEqual(homePageMetadata("").robots, { index: true, follow: true });
});
