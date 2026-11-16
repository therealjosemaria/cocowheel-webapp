import test from "node:test";
import assert from "node:assert/strict";
import { TRIPO_MODELS, TRIPO_IMAGE_MODELS, comparisonPayload, comparisonImagePayload } from "../lib/tripo-comparison";
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
    "seedream_v5.glb",
    "chat_image_2.5_sunburst.png/../secret",
  ])
    assert.equal(comparisonAsset(name), null);
  assert.ok(comparisonAsset("reference.png"));
  assert.ok(comparisonAsset("P2-20260801.glb"));
  assert.ok(comparisonAsset("seedream_v5.png"));
  assert.ok(comparisonAsset("chat_image_2.5_sunburst.png"));
});

test("image comparison pins two reference-editing models with a 15-credit base plan and compatible parameters", () => {
  assert.equal(TRIPO_IMAGE_MODELS.reduce((sum, model) => sum + model.estimatedCredits, 0), 15);
  const sun = comparisonImagePayload("same-photo", TRIPO_IMAGE_MODELS[0].id);
  const seed = comparisonImagePayload("same-photo", TRIPO_IMAGE_MODELS[1].id);
  assert.equal(sun.prompt, seed.prompt); assert.equal(sun.input, seed.input);
  assert.deepEqual(sun, { input: "same-photo", model: "chat_image_2.5_sunburst", prompt: sun.prompt, output_format: "png", size: "1024x1536", quality: "medium", background: "transparent" });
  assert.equal("quality" in seed, false); assert.equal("background" in seed, false);
  assert.throws(() => comparisonImagePayload("same-photo", "P2-20260801"));
});

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
test("two-image runner reuses the exact reference and P2, resumes without resubmitting and rejects insufficient funds or uncertain outcomes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "tripo-images-"));
  const photo = await sharp({ create: { width: 400, height: 800, channels: 3, background: "white" } }).png().toBuffer();
  const args = ["--import", "tsx", "--import", path.resolve("tests/fixtures/tripo-fetch.mjs"), "scripts/tripo-image-compare.mts", "--run"];
  const env = { ...process.env, TRIPO_API_KEY: "synthetic-image-key", TRIPO_COMPARISON_DIR: root, TRIPO_TEST_LOG: path.join(root, "submitted.jsonl") };
  const baseline = { referenceHash: createHash("sha256").update(photo).digest("hex"), rows: [{ name: "P2", id: "P2-20260801", status: "success", estimatedCredits: 110, previewReady: true, modelReady: true, taskId: "existing-P2" }] };
  try {
    await writeFile(path.join(root, "reference.png"), photo);
    await writeFile(path.join(root, "comparison.json"), JSON.stringify(baseline));
    execFileSync(process.execPath, args, { env });
    const result = JSON.parse(await readFile(path.join(root, "comparison.json"), "utf8"));
    assert.deepEqual(result.rows[0], baseline.rows[0]);
    assert.equal(result.rows.length, 3);
    assert.deepEqual(result.rows.slice(1).map((r: { chargedCredits: number }) => r.chargedCredits), [10, 5]);
    assert.deepEqual(result.rows.slice(1).map((r: { transparent: boolean }) => r.transparent), [true, false]);
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).trim().split('\n').length, 2);
    execFileSync(process.execPath, args, { env });
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).trim().split('\n').length, 2);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-image-key|https:/);
    await writeFile(path.join(root, "comparison.json"), JSON.stringify(baseline));
    await writeFile(env.TRIPO_TEST_LOG, "");
    assert.throws(() => execFileSync(process.execPath, args, { env: { ...env, TRIPO_TEST_BALANCE: "14" }, stdio: "pipe" }));
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).length, 0);
    assert.throws(() => execFileSync(process.execPath, args, { env: { ...env, TRIPO_TEST_UNCERTAIN: "1" }, stdio: "pipe" }));
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).trim().split('\n').length, 1);
    assert.throws(() => execFileSync(process.execPath, args, { env, stdio: "pipe" }));
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).trim().split('\n').length, 1);
    await writeFile(path.join(root, "reference.png"), Buffer.from("changed-photo"));
    assert.throws(() => execFileSync(process.execPath, args, { env, stdio: "pipe" }));
    assert.equal((await readFile(env.TRIPO_TEST_LOG, "utf8")).trim().split('\n').length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
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
