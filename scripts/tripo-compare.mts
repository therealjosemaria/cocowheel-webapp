/** Offline plan by default. --run explicitly permits five paid tasks. Never retry uncertain POSTs. */
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  open,
  unlink,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  TRIPO_MODELS,
  comparisonPayload,
  type Comparison,
} from "../lib/tripo-comparison";
import { comparisonDirectory } from "../server/tripo-comparison";
const args = process.argv.slice(2);
if (!args.includes("--run")) {
  console.log(
    JSON.stringify(
      {
        paidTasks: 5,
        models: TRIPO_MODELS,
        usage:
          "TRIPO_API_KEY set server-side; node --import tsx scripts/tripo-compare.mts --run /private/reference.jpg",
        note: "No API calls. Unknown estimates must be checked in the account before running.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const input = args.find((v) => v !== "--run");
if (!input || !process.env.TRIPO_API_KEY)
  throw new Error(
    "Provide a reference path and server-side TRIPO_API_KEY; run without --run to inspect the plan.",
  );
const root = comparisonDirectory();
await mkdir(root, { recursive: true, mode: 0o700 });
const lockPath = path.join(root, "run.lock");
const lock = await open(lockPath, "wx", 0o600).catch(() => {
  throw new Error(
    "Comparison locked. Check the running process and saved task IDs before removing run.lock; do not resubmit blindly.",
  );
});
try {
  const info = await stat(input);
  if (info.size > 20 * 1024 * 1024)
    throw new Error("Image exceeds 20MB; provide a smaller photo.");
  const image = sharp(await readFile(input), { limitInputPixels: 32_000_000 });
  const meta = await image.metadata();
  if (
    !["png", "jpeg", "webp"].includes(meta.format || "") ||
    (meta.pages || 1) > 1
  )
    throw new Error("Use a still PNG, JPEG or WebP photo.");
  const bytes = await image.rotate().png().toBuffer(); // strips EXIF/GPS, identical bytes across all models
  if (bytes.length > 20 * 1024 * 1024)
    throw new Error("Normalized image exceeds 20MB; provide a smaller photo.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const manifest = path.join(root, "comparison.json");
  let result: Comparison;
  try {
    result = JSON.parse(await readFile(manifest, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    result = {
      referenceHash: hash,
      rows: TRIPO_MODELS.map((m) => ({ ...m, status: "Not started" })),
    };
  }
  if (result.referenceHash !== hash)
    throw new Error(
      "Another reference is saved. Archive the comparison directory before starting a different reference.",
    );
  async function save() {
    await writeFile(`${manifest}.tmp`, JSON.stringify(result, null, 2), {
      mode: 0o600,
    });
    await rename(`${manifest}.tmp`, manifest);
  }
  async function api(
    endpoint: string,
    body?: FormData | Record<string, unknown>,
  ) {
    const response = await fetch(`https://openapi.tripo3d.ai/v3${endpoint}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
      headers: {
        Authorization: `Bearer ${process.env.TRIPO_API_KEY}`,
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    if (!response.ok)
      throw new Error(
        `Tripo HTTP ${response.status}; check the account and saved task before continuing.`,
      );
    const json = await response.json();
    if (json.code !== 0)
      throw new Error(
        `Tripo code ${Number(json.code)}; check the account before continuing.`,
      );
    return json.data;
  }
  async function download(url: string, file: string, model: boolean) {
    const address = new URL(url);
    // Provider artifact hosts only, never send API authorization to asset storage.
    if (
      address.protocol !== "https:" ||
      !/(^|\.)(tripo3d\.ai|tripo-data\.s3\.amazonaws\.com|amazonaws\.com)$/.test(
        address.hostname,
      )
    )
      throw new Error(
        "Unexpected artifact host; inspect the task in Tripo before downloading.",
      );
    const response = await fetch(address, {
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok || !response.body)
      throw new Error(
        "Artifact download failed; resume the saved task without regenerating.",
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 150 * 1024 * 1024) throw new Error("Artifact exceeds 150MB.");
      chunks.push(chunk);
    }
    const output = Buffer.concat(chunks);
    const content = model ? output : await sharp(output).png().toBuffer();
    if (model && output.subarray(0, 4).toString() !== "glTF")
      throw new Error(
        "Expected GLB; inspect the task output before continuing.",
      );
    await writeFile(path.join(root, file), content, { mode: 0o600 });
  }
  const balance = await api("/account/balance");
  if (result.rows.some((row) => !row.taskId) && !(balance.balance > 0))
    throw new Error(
      "Tripo API balance is empty. Top up the API balance before running this test.",
    );
  await writeFile(path.join(root, "reference.png"), bytes, { mode: 0o600 });
  await save();
  let token: string | undefined;
  for (const row of result.rows) {
    if (row.status === "success" && row.modelReady) continue;
    if (!row.taskId) {
      if (row.status !== "Not started")
        throw new Error(
          "Submission outcome uncertain. Inspect Tripo task history and recover its ID before continuing; no automatic retry.",
        );
      if (!token) {
        const form = new FormData();
        form.append(
          "file",
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          "reference.png",
        );
        token = (await api("/files", form)).file_token;
      }
      if (!token)
        throw new Error(
          "Upload returned no token; inspect Tripo before continuing.",
        );
      row.status = "Submission uncertain";
      row.submittedAt = Date.now();
      await save();
      const task = await api(
        "/generation/image-to-model",
        comparisonPayload(token, row.id),
      );
      if (typeof task.task_id !== "string" || !task.task_id)
        throw new Error(
          "Missing task ID; inspect task history before resubmitting.",
        );
      row.taskId = task.task_id;
      row.status = "queued";
      await save();
    }
    const deadline = Date.now() + 30 * 60_000;
    while (Date.now() < deadline) {
      const task = await api(`/tasks/${encodeURIComponent(row.taskId!)}`);
      row.status = task.status;
      if (task.status === "success") {
        row.elapsedSeconds ??= Math.round(
          (Date.now() - row.submittedAt!) / 1000,
        );
        await save();
        if (typeof task.output?.model_url !== "string")
          throw new Error(
            "Missing model output; inspect the saved task without regenerating.",
          );
        await download(task.output.model_url, `${row.id}.glb`, true);
        row.modelReady = true;
        if (task.output.rendered_image_url) {
          await download(
            task.output.rendered_image_url,
            `${row.id}.png`,
            false,
          );
          row.previewReady = true;
        }
        await save();
        break;
      }
      await save();
      if (
        ["failed", "cancelled", "canceled", "expired", "banned"].includes(
          task.status,
        )
      )
        throw new Error(
          `${row.name} ${task.status}; inspect billing before another attempt.`,
        );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!row.modelReady)
      throw new Error(
        "Polling timed out. Resume this command to query the existing task; do not create another.",
      );
  }
  // Match task-level billing; a wallet delta could include unrelated account work.
  try {
    const usage = await api("/account/usage");
    if (Array.isArray(usage))
      for (const row of result.rows) {
        const entry = usage.find((item) => item.task_id === row.taskId);
        if (Number.isFinite(entry?.credits_consumed))
          row.chargedCredits = entry.credits_consumed;
      }
    await save();
  } catch {
    console.warn(
      "Billing lookup unavailable; charges remain unverified. Check task IDs in account usage.",
    );
  }
  console.log(
    "Comparison saved privately. Open /admin/avatars after API/frontend deployment. Actual charges remain unverified until checked against billing.",
  );
} finally {
  await lock.close();
  await unlink(lockPath);
}
