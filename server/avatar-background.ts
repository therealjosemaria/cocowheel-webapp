import { spawn } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

export type AvatarBackgroundProcessor = { check: () => Promise<void>; remove: (image: Buffer) => Promise<Buffer> };
export class AvatarBackgroundError extends Error { constructor() { super("BACKGROUND_REMOVAL_REVIEW"); } }

function runLocalBackground(image?: Buffer): Promise<Buffer> {
  const python = process.env.COCOWHEELS_AVATAR_CUTOUT_PYTHON || path.resolve("data/avatar-cutout-runtime/bin/python");
  const model = process.env.COCOWHEELS_AVATAR_CUTOUT_MODEL || path.resolve("data/avatar-cutout-models/u2net-human.onnx");
  return new Promise((resolve, reject) => {
    // A separate low-priority CPU process keeps inference off the API event loop.
    const child = spawn("nice", ["-n", "10", python, path.resolve("workers/avatar/background_remove.py"), "--model", model, ...(image ? [] : ["--check"])], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: process.env.PATH, NODE_ENV: process.env.NODE_ENV ?? "production", LANG: "C.UTF-8", PYTHONNOUSERSITE: "1", OMP_NUM_THREADS: "2", OPENBLAS_NUM_THREADS: "2", NUMBA_NUM_THREADS: "2" },
    });
    const chunks: Buffer[] = []; let size = 0, settled = false;
    const finish = (error?: Error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) { child.kill("SIGKILL"); reject(new AvatarBackgroundError()); }
      else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new Error("timeout")), image ? 120_000 : 30_000);
    child.on("error", () => finish(new Error("unavailable")));
    child.stdout.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 10_000_000) finish(new Error("too large")); else chunks.push(chunk); });
    child.stderr.resume(); // Do not expose file paths, model internals or private input in errors.
    child.on("close", code => finish(code === 0 && size > 0 ? undefined : new Error("processing failed")));
    child.stdin.on("error", () => undefined); // A failed preflight/decoder can close stdin early.
    child.stdin.end(image);
  });
}

export const avatarBackground: AvatarBackgroundProcessor = {
  async check() { if ((await runLocalBackground()).toString() !== "READY") throw new AvatarBackgroundError(); },
  async remove(image) {
    const meta = await sharp(image, { limitInputPixels: 16_000_000, failOn: "warning" }).metadata();
    if (!["png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) !== 1) throw new AvatarBackgroundError();
    const stats = await sharp(image, { limitInputPixels: 16_000_000 }).stats();
    // A provider result that already contains transparency needs no extra inference.
    if (meta.hasAlpha && stats.channels[3]?.min < 255) return image;
    return runLocalBackground(image);
  },
};
