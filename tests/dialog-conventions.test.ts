import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PoorFitPrompt from "../components/poor-fit-prompt";
import CancelPrompt from "../components/cancel-prompt";

test("poor-fit confirmation uses the shared centred shell and primary-first order", () => {
  const html = renderToStaticMarkup(
    createElement(PoorFitPrompt, {
      close() {},
      confirm() {},
    }),
  );
  assert.match(html, /class="cancel-prompt"/);
  assert.match(html, /class="primary"[^>]*>CONTINUE/);
  assert.ok(html.indexOf("CONTINUE") < html.indexOf("GO BACK"));
  assert.match(html, /aria-describedby="poor-fit-message"/);
  assert.doesNotMatch(html, /<h[1-6]/);
});

test("destructive confirmations retain safe-first order", () => {
  for (const request of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(CancelPrompt, {
        busy: false,
        request,
        close() {},
        confirm() {},
      }),
    );
    const action = request ? "WITHDRAW REQUEST" : "CANCEL RIDE";
    assert.ok(html.indexOf("KEEP IT") < html.indexOf(action));
    assert.match(html, /class="danger"/);
    assert.doesNotMatch(html, /<h[1-6]/);
  }
});
