// Explicit operator recovery. No paid POST, notification, preference or trip change.
import { mkdir, readFile, chmod, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import Database from "better-sqlite3";
import sharp from "sharp";
import { completedAvatarImage } from "../server/avatar-generation";
import { avatarBackground } from "../server/avatar-background";
import { prepareAvatarRenditions } from "../server/map-avatars";
import { restoreAvatarPreview } from "../server/avatar-preview-recovery";

if (process.argv.slice(2).join(" ") !== "--latest-ready --apply") throw new Error("Usage: node --import tsx scripts/restore-avatar-preview.mts --latest-ready --apply");
for (const [key, value] of Object.entries(parseEnv(await readFile(".env", "utf8")))) if (process.env[key] === undefined) process.env[key] = value;
const db = new Database(process.env.COCOWHEELS_DB_PATH || "data/cocowheels.db", { fileMustExist: true });
db.pragma("foreign_keys=ON");
function idle() {
  if (db.prepare("SELECT 1 FROM rides WHERE status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE') LIMIT 1").get() ||
      db.prepare("SELECT 1 FROM avatar_jobs WHERE status IN ('CHECKING','SUBMITTING','GENERATING') LIMIT 1").get()) throw new Error("RECOVERY_REQUIRES_IDLE_SERVICE");
}
try {
  idle();
  const job = db.prepare(`SELECT j.id,j.task_id,j.generation_model,j.render FROM avatar_jobs j
    JOIN account_map_avatars a ON a.principal_id=j.principal_id
    WHERE j.status='READY' AND j.task_id IS NOT NULL AND j.render=a.sprite AND a.preview IS NULL
    ORDER BY j.updated_at DESC LIMIT 1`).get() as { id: string; task_id: string; generation_model: string; render: Buffer } | undefined;
  if (!job) throw new Error("NO_MATCHING_LEGACY_PREVIEW");
  const legacy = !job.generation_model || job.generation_model === "P2-20260801";
  const source = await completedAvatarImage(job.task_id, legacy);
  const cutout = legacy ? source : await avatarBackground.remove(source);
  const assets = await prepareAvatarRenditions(cutout);
  if (!assets.sprite.equals(job.render)) throw new Error("RECOVERED_SPRITE_DOES_NOT_MATCH");
  const folder = `data/backups/avatar-preview-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await db.backup(`${folder}/database.sqlite`); await chmod(`${folder}/database.sqlite`, 0o600);
  idle();
  restoreAvatarPreview(db, job.id, job.render, assets);
  const info = await sharp(assets.preview).metadata();
  const report = { restored: 1, preview: { width: info.width, height: info.height, bytes: assets.preview.length }, mapLightBytes: assets.sprite.length, mapDetailBytes: assets.detail.length, paidTasksCreated: 0, preferencesChanged: false, lifecycleChanged: false };
  await writeFile(`${folder}/result.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
} finally { db.close(); }
