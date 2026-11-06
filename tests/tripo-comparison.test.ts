import test from "node:test";
import assert from "node:assert/strict";
import { TRIPO_MODELS, comparisonPayload } from "../lib/tripo-comparison";
import { comparisonAsset } from "../server/tripo-comparison";
test("comparison pins five explicit V3 models and only shared supported options", () => {
  assert.equal(new Set(TRIPO_MODELS.map((m) => m.id)).size, 5);
  for (const m of TRIPO_MODELS) {
    const payload = comparisonPayload("file_reference", m.id);
    assert.equal(payload.model, m.id);
    assert.equal(payload.input, "file_reference");
    assert.equal("geometry_quality" in payload, false);
    assert.equal("texture_quality" in payload, false);
  }
  assert.throws(() => comparisonPayload("file_reference", "unapproved"));
});
test("private comparison assets reject traversal and unknown files", () => {
  for (const name of [
    "../comparison.json",
    "%2e%2e/secret",
    "comparison.json",
    "run.lock",
    "P2-20260801.glb/../secret",
    "secret.png",
  ])
    assert.equal(comparisonAsset(name), null);
  assert.ok(comparisonAsset("reference.png"));
  assert.ok(comparisonAsset("P2-20260801.glb"));
});

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
test("mocked comparison generates five tasks once, preserves task IDs and resumes without spending", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "tripo-test-"));
  try {
    const image = path.join(root, "photo.png");
    await sharp({
      create: { width: 256, height: 256, channels: 3, background: "white" },
    })
      .png()
      .toFile(image);
    const log = path.join(root, "submitted.jsonl");
    const args = [
      "--import",
      "tsx",
      "--import",
      path.resolve("tests/fixtures/tripo-fetch.mjs"),
      "scripts/tripo-compare.mts",
      "--run",
      image,
    ];
    const env = {
      ...process.env,
      TRIPO_API_KEY: "test-only-not-a-key",
      TRIPO_COMPARISON_DIR: path.join(root, "results"),
      TRIPO_TEST_LOG: log,
    };
    execFileSync(process.execPath, args, { env });
    const first = JSON.parse(
      await readFile(path.join(root, "results/comparison.json"), "utf8"),
    );
    assert.equal(first.rows.length, 5);
    assert.ok(
      first.rows.every(
        (row: { modelReady: boolean; status: string }) =>
          row.modelReady && row.status === "success",
      ),
    );
    const submitted = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      submitted.map((p) => p.model),
      TRIPO_MODELS.map((m) => m.id),
    );
    assert.equal(new Set(submitted.map((p) => p.input)).size, 1);
    execFileSync(process.execPath, args, { env });
    assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 5);
    assert.ok(!JSON.stringify(first).includes("test-only-not-a-key"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zero balance does not submit and uncertain submission is never repeated", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "tripo-failure-"));
  try {
    const image = path.join(root, "photo.png");
    await sharp({
      create: { width: 256, height: 256, channels: 3, background: "white" },
    })
      .png()
      .toFile(image);
    const log = path.join(root, "submitted.jsonl");
    const args = [
      "--import",
      "tsx",
      "--import",
      path.resolve("tests/fixtures/tripo-fetch.mjs"),
      "scripts/tripo-compare.mts",
      "--run",
      image,
    ];
    const env = {
      ...process.env,
      TRIPO_API_KEY: "test-only-not-a-key",
      TRIPO_COMPARISON_DIR: path.join(root, "results"),
      TRIPO_TEST_LOG: log,
    };
    assert.throws(
      () =>
        execFileSync(process.execPath, args, {
          env: { ...env, TRIPO_TEST_ZERO: "1" },
          stdio: "pipe",
        }),
      /balance is empty/,
    );
    await assert.rejects(readFile(log), /ENOENT/);
    assert.throws(() =>
      execFileSync(process.execPath, args, {
        env: { ...env, TRIPO_TEST_UNCERTAIN: "1" },
        stdio: "pipe",
      }),
    );
    assert.throws(
      () => execFileSync(process.execPath, args, { env, stdio: "pipe" }),
      /Submission outcome uncertain/,
    );
    assert.equal((await readFile(log, "utf8")).trim().split("\n").length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
