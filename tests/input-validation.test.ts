import assert from "node:assert/strict";
import test from "node:test";
import { payIdInputError, searchInputError } from "../lib/input-validation";
import { searchPlaces } from "../server/place-label";

test("PayID limits accept common formatting and reject malformed input", () => {
  for (const phone of ["0412345678", "0412 345 678", "+61 412 345 678"])
    assert.equal(payIdInputError(phone, "MOBILE"), null);
  for (const phone of ["04123", "04123456789", "abcdef", "1234567890"])
    assert.ok(payIdInputError(phone, "MOBILE"));
  for (const email of ["name@example.com", "name+tag@example.com.au"])
    assert.equal(payIdInputError(email, "EMAIL"), null);
  for (const email of [
    "a@@example.com",
    "no-at-sign",
    "a b@example.com",
    "a..b@example.com",
    "a@example..com",
    "x".repeat(65) + "@example.com",
  ])
    assert.ok(payIdInputError(email, "EMAIL"));
  assert.equal(payIdInputError("51 824 753 556", "OTHER"), null);
  assert.ok(payIdInputError("1234567890", "OTHER"));
  assert.equal(
    payIdInputError("Example Community Organisation", "OTHER"),
    null,
  );
  assert.ok(payIdInputError(Array(21).fill("word").join(" "), "OTHER"));
  assert.ok(payIdInputError("x".repeat(161), "OTHER"));
  assert.equal(payIdInputError("", "MOBILE"), null);
});

test("search length and word limits reject before calling the provider", async () => {
  assert.equal(searchInputError(Array(30).fill("place").join(" ")), null);
  assert.ok(searchInputError(Array(31).fill("place").join(" ")));
  assert.ok(searchInputError("x".repeat(301)));
  assert.ok(searchInputError("Bondi\u0000Beach"));
  let called = false;
  await assert.rejects(
    () =>
      searchPlaces("x".repeat(301), undefined, undefined, "test", async () => {
        called = true;
        return new Response("{}");
      }),
    /INVALID_SEARCH_TEXT/,
  );
  assert.equal(called, false);
});
