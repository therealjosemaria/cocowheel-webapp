import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PoorFitPrompt from "../components/poor-fit-prompt";
import CancelPrompt from "../components/cancel-prompt";
import { CompleteRide } from "../components/ride-journey-controls";
import type { Ride } from "../lib/client-types";

test("Complete is visible only for a verified pickup in progress", () => {
  for (const status of [
    "ACCEPTED",
    "RIDE_ACTIVE",
    "CO_RIDE_ACTIVE",
    "COMPLETED",
    "CANCELLED",
  ] as const) {
    for (const pickupEstablished of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(CompleteRide, {
          ride: { status, pickupEstablished } as Ride,
        }),
      );
      assert.equal(
        html.includes("COMPLETE RIDE"),
        status === "CO_RIDE_ACTIVE" && pickupEstablished,
      );
    }
  }
});

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
