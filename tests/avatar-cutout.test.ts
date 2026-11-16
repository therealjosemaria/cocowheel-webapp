import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

test("offline cutout preserves subject colours and enclosed white clothing, without changing the source", async () => {
  const { cutoutWhiteBackground } = await import(new URL("../scripts/cutout-white-background.mjs", import.meta.url).href);
  const width = 30, height = 50;
  const pixels = Buffer.alloc(width * height * 3, 255);
  for (let y = 6; y < 45; y++) for (let x = 8; x < 22; x++) {
    const offset = (y * width + x) * 3;
    pixels[offset] = 70; pixels[offset + 1] = 50; pixels[offset + 2] = 40;
  }
  // White clothing enclosed by the person's silhouette must remain visible.
  for (let y = 18; y < 28; y++) for (let x = 12; x < 18; x++)
    pixels.fill(250, (y * width + x) * 3, (y * width + x) * 3 + 3);
  const source = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const before = Buffer.from(source);
  const result = await cutoutWhiteBackground(source);
  const { data, info } = await sharp(result.png).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.equal(data[3], 0);
  assert.equal(data[(20 * width + 14) * 4 + 3], 255);
  for (let pixel = 0; pixel < width * height; pixel++)
    assert.deepEqual(data.subarray(pixel * 4, pixel * 4 + 3), pixels.subarray(pixel * 3, pixel * 3 + 3));
  assert.deepEqual(source, before);
  const blank = await sharp({ create: { width, height, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(cutoutWhiteBackground(blank), /needs visual review/);
});
