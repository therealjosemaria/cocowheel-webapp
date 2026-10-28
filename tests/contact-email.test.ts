import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HelpPage from "../app/help/page";
import PrivacyPage from "../app/privacy/page";
import TermsPage from "../app/terms/page";
import AboutPage from "../app/about/page";

test("public contact links use Gumwheel email without changing the suggestion subject", () => {
  for (const [page, Component] of [["help", HelpPage], ["privacy", PrivacyPage], ["terms", TermsPage], ["about", AboutPage]] as const) {
    const source = renderToStaticMarkup(createElement(Component));
    const links = [...source.matchAll(/href="(mailto:[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, [page === "help"
      ? "mailto:jose@gumwheel.com?subject=GUMWHEEL%20suggestion"
      : "mailto:jose@gumwheel.com"]);
    assert.ok(!source.includes("jmos0905@uni.sydney.edu.au"));
    if (page !== "help") assert.match(source, />\s*jose@gumwheel\.com\s*<\/a>/);
  }
});
