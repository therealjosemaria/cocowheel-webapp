import assert from "node:assert/strict";
import test from "node:test";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
import { homePageMetadata, publicPageMetadata, SITE_URL } from "../lib/seo";
import { GET as guide } from "../app/llms.txt/route";
import { GET as markdown } from "../app/help.md/route";
import { HELP_FAQS, ABOUT_SUMMARY } from "../lib/public-information";
import { siteIdentity } from "../components/public-site-identity";

test("search discovery lists only the public information pages on the canonical domain", () => {
  assert.deepEqual(sitemap().map(item => item.url), ["/", "/help", "/about", "/privacy", "/terms"].map(path => new URL(path, SITE_URL).href));
  assert.deepEqual(robots(), { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` });
});

test("assistant guide and readable Help use public product facts without claiming availability", async () => {
  const response = guide();
  const text = await response.text();
  assert.match(response.headers.get("content-type")!, /text\/plain/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.ok(text.includes(ABOUT_SUMMARY));
  assert.match(text, /not guaranteed/);
  assert.match(text, /does not grant permission/);
  for (const link of ["/about", "/help", "/help.md", "/privacy", "/terms"]) assert.ok(text.includes(SITE_URL + link));
  assert.doesNotMatch(text, /cocowheels_guest|challengeId|\/api\//);
});

test("Markdown Help stays consistent with all visible FAQ answers and canonicalizes to HTML", async () => {
  const response = markdown();
  const text = await response.text();
  assert.match(response.headers.get("content-type")!, /text\/markdown/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
  assert.equal(response.headers.get("link"), `<${SITE_URL}/help>; rel="canonical"`);
  for (const { question, answer } of HELP_FAQS) {
    assert.ok(text.includes(question));
    assert.ok(text.includes(answer));
  }
});

test("site identity describes the real brand and public contact without invented ratings or addresses", () => {
  assert.deepEqual(siteIdentity["@graph"].map(entity => entity["@type"]), ["WebSite", "Organization"]);
  for (const entity of siteIdentity["@graph"]) assert.equal(entity.name, "GUMWHEEL");
  assert.doesNotMatch(JSON.stringify(siteIdentity), /aggregateRating|reviewCount|PostalAddress|SearchAction/);
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
