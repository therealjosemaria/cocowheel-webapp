import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RideStatusText from "../components/ride-status-text";

test("only ongoing status labels pulse and offer a pause control", () => {
  for (const label of [
    "Request pending",
    "Awaiting pickup",
    "Ride in progress",
    "Published",
  ]) {
    const html = renderToStaticMarkup(createElement(RideStatusText, { label }));
    assert.match(html, /Pause status animation/);
    assert.match(html, /ride-status-text/);
  }
  for (const label of [
    "Completed",
    "Cancelled",
    "Expired",
    "Declined",
    "Withdrawn",
    "Unavailable",
  ]) {
    const html = renderToStaticMarkup(createElement(RideStatusText, { label }));
    assert.equal(html, `<span class="ride-status-finished">${label}</span>`);
  }
});
