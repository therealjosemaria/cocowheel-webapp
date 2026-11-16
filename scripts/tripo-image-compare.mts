/** Private two-image comparison. Offline by default; never retry an uncertain paid POST. */
import { readFile, writeFile, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { TRIPO_IMAGE_MODELS, comparisonImagePayload, type Comparison } from "../lib/tripo-comparison";
import { comparisonDirectory } from "../server/tripo-comparison";

if (!process.argv.includes("--run")) {
  console.log(JSON.stringify({ paidTasks: 2, models: TRIPO_IMAGE_MODELS, estimatedCredits: 15, reuse: "Existing reference.png and P2 result; no P2 generation", note: "Offline plan only. --run authorizes one task per new image model." }));
  process.exit(0);
}
if (!process.env.TRIPO_API_KEY) throw new Error("Set TRIPO_API_KEY server-side before running the paid comparison.");
const root = comparisonDirectory(), manifest = path.join(root, "comparison.json"), lockPath = path.join(root, "run.lock");
const lock = await open(lockPath, "wx", 0o600).catch(() => { throw new Error("Comparison locked. Inspect saved task IDs before another run; do not resubmit blindly."); });
try {
  const result: Comparison = JSON.parse(await readFile(manifest, "utf8"));
  const photo = await readFile(path.join(root, "reference.png"));
  if (photo.length > 20_000_000 || createHash("sha256").update(photo).digest("hex") !== result.referenceHash)
    throw new Error("Saved reference does not match the original comparison. Resolve the reference before spending.");
  if (!result.rows.some(row => row.id === "P2-20260801" && row.previewReady)) throw new Error("Keep the completed P2 reference result before adding this comparison.");
  await sharp(photo, { limitInputPixels: 32_000_000 }).metadata();
  const save = async () => { await writeFile(manifest + ".tmp", JSON.stringify(result, null, 2), { mode: 0o600 }); await rename(manifest + ".tmp", manifest); };
  const api = async (endpoint: string, body?: FormData | Record<string, unknown>) => {
    const response = await fetch(`https://openapi.tripo3d.ai/v3${endpoint}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${process.env.TRIPO_API_KEY}`, ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`Tripo HTTP ${response.status}. Inspect saved tasks before continuing.`);
    const json = await response.json();
    if (json.code !== 0 || json.data == null) throw new Error(`Tripo code ${Number(json.code)}. Inspect the account before continuing.`);
    return json.data;
  };
  for (const model of TRIPO_IMAGE_MODELS)
    if (!result.rows.some(row => row.id === model.id)) result.rows.push({ ...model, kind: "image", status: "Not started" });
  const rows = result.rows.filter(row => TRIPO_IMAGE_MODELS.some(model => model.id === row.id));
  const budget = TRIPO_IMAGE_MODELS.filter(model => !rows.find(row => row.id === model.id)?.taskId).reduce((sum, model) => sum + model.estimatedCredits, 0);
  const balance = await api("/account/balance");
  if (!Number.isFinite(balance.balance) || balance.balance < budget) throw new Error(`The remaining test needs ${budget} credits. Top up the API account before submitting.`);
  await save();
  let token: string | undefined;
  for (const row of rows) {
    if (row.status === "success" && row.previewReady) continue;
    if (!row.taskId) {
      if (row.status !== "Not started") throw new Error("Submission outcome uncertain. Recover its task ID from Tripo history; do not generate again.");
      if (!token) {
        const form = new FormData(); form.append("file", new Blob([new Uint8Array(photo)], { type: "image/png" }), "reference.png");
        token = (await api("/files", form)).file_token;
        if (!token) throw new Error("Missing file token. Inspect the upload before continuing.");
      }
      row.status = "Submission uncertain"; row.submittedAt = Date.now(); await save();
      const task = await api("/generation/image-to-image", comparisonImagePayload(token, row.id));
      if (typeof task.task_id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(task.task_id)) throw new Error("Missing task ID. Recover it from task history before continuing.");
      row.taskId = task.task_id; row.status = "queued"; await save();
      console.log(`${row.name}: submitted one image task.`);
    }
    const deadline = Date.now() + 20 * 60_000;
    while (Date.now() < deadline) {
      const task = await api(`/tasks/${encodeURIComponent(row.taskId!)}`);
      if (typeof task.status !== "string") throw new Error("Missing task status. Inspect the saved task without resubmitting.");
      row.status = task.status;
      if (Number.isFinite(task.credits_consumed)) row.chargedCredits = task.credits_consumed;
      await save();
      if (row.status === "success") {
        row.elapsedSeconds ??= Math.round((Date.now() - row.submittedAt!) / 1000);
        await save();
        const address = new URL(task.output?.generated_image_url ?? "");
        if (address.protocol !== "https:" || !/(^|\.)(tripo3d\.ai|openapi-dl\.data\.tripo3d\.com|tripo-data\.s3\.amazonaws\.com)$/.test(address.hostname)) throw new Error("Unexpected image host. Inspect the completed task without regenerating.");
        // Artifact storage never receives the API key, including on redirects.
        const response = await fetch(address, { redirect: "error", signal: AbortSignal.timeout(60_000) });
        if (!response.ok || !response.body) throw new Error("Image download failed. Resume the saved task without generating again.");
        const chunks: Uint8Array[] = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; if (size > 30_000_000) throw new Error("Image too large. Inspect the completed task."); chunks.push(chunk); }
        const image = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000, failOn: "warning" });
        const metadata = await image.metadata();
        if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) throw new Error("Unexpected image format. Inspect the completed task.");
        const stats = await image.stats();
        const output = path.join(root, row.id + ".png");
        await writeFile(output + ".tmp", await image.png().toBuffer(), { mode: 0o600 }); await rename(output + ".tmp", output);
        row.previewReady = true; row.width = metadata.width; row.height = metadata.height;
        row.transparent = !!metadata.hasAlpha && (stats.channels.at(-1)?.min ?? 255) < 255;
        await save(); console.log(`${row.name}: image saved privately (${row.width}×${row.height}; transparent=${row.transparent}).`); break;
      }
      if (["failed", "cancelled", "canceled", "expired", "banned"].includes(row.status)) throw new Error(`${row.name}: ${row.status}. Inspect task/billing before another attempt.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (!row.previewReady) throw new Error("Polling timed out. Resume this command to query the saved task; never resubmit it.");
  }
  const usage = await api("/account/usage");
  if (Array.isArray(usage)) for (const row of rows) {
    const entry = usage.find(item => item.task_id === row.taskId);
    if (Number.isFinite(entry?.credits_consumed)) row.chargedCredits = entry.credits_consumed;
  }
  await save();
  console.log(JSON.stringify({ results: rows.map(({ name, status, elapsedSeconds, estimatedCredits, chargedCredits, width, height, transparent }) => ({ name, status, elapsedSeconds, estimatedCredits, chargedCredits, width, height, transparent })), balance: (await api("/account/balance")).balance }));
} finally { await lock.close(); await unlink(lockPath); }
