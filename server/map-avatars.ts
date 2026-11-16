import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { Db } from "./core";
import type { MapAvatar } from "../lib/map-avatar";

export function initializeMapAvatars(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_map_avatars (
    principal_id TEXT PRIMARY KEY REFERENCES guest_sessions(id),
    asset_id TEXT NOT NULL UNIQUE,
    sprite BLOB NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
    assigned_at TEXT NOT NULL
  )`);
  const columns = new Set((db.prepare("PRAGMA table_info(account_map_avatars)").all() as { name: string }[]).map(column => column.name));
  for (const name of ["preview", "detail"]) if (!columns.has(name)) db.exec(`ALTER TABLE account_map_avatars ADD COLUMN ${name} BLOB`);
}

export function avatarArtwork(db: Db, principal: string): string | undefined {
  const row = db.prepare("SELECT asset_id FROM account_map_avatars WHERE principal_id=? AND enabled=1")
    .get(principal) as { asset_id: string } | undefined;
  return row ? `/api/map-avatar/${row.asset_id}.webp` : undefined;
}

export function readMapAvatar(db: Db, principal: string): MapAvatar {
  const row = db.prepare("SELECT asset_id,enabled FROM account_map_avatars WHERE principal_id=?")
    .get(principal) as { asset_id: string; enabled: number } | undefined;
  return {
    available: Boolean(row), enabled: Boolean(row?.enabled),
    previewUrl: row ? `/api/avatar/preview?v=${row.asset_id}` : null,
    artworkUrl: row?.enabled ? `/api/map-avatar/${row.asset_id}.webp` : null,
  };
}

export function saveMapAvatar(db: Db, principal: string, enabled: unknown): MapAvatar {
  if (typeof enabled !== "boolean") throw new Error("INVALID_AVATAR_PREFERENCE");
  if (enabled && !readMapAvatar(db, principal).available) throw new Error("AVATAR_UNAVAILABLE");
  db.prepare("UPDATE account_map_avatars SET enabled=? WHERE principal_id=?").run(Number(enabled), principal);
  return readMapAvatar(db, principal);
}

export function avatarSprite(db: Db, assetId: string, detail = false): Buffer | undefined {
  if (!/^[a-f0-9]{32}$/.test(assetId)) return;
  return (db.prepare(`SELECT ${detail ? "COALESCE(detail,sprite)" : "sprite"} AS sprite FROM account_map_avatars WHERE asset_id=? AND enabled=1`)
    .get(assetId) as { sprite: Buffer } | undefined)?.sprite;
}

export function ownAvatarSprite(db: Db, principal: string): Buffer | undefined {
  return (db.prepare("SELECT COALESCE(preview,sprite) AS sprite FROM account_map_avatars WHERE principal_id=?")
    .get(principal) as { sprite: Buffer } | undefined)?.sprite;
}

export type AvatarRenditions = { sprite: Buffer; detail: Buffer; preview: Buffer };

function approvedImage(bytes: Buffer) {
  if (bytes.length > 10_000_000) throw new Error("INVALID_AVATAR_IMAGE");
  return sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
}
async function validateRender(bytes: Buffer) {
  const image = approvedImage(bytes);
  const metadata = await image.metadata();
  if (!["png", "webp"].includes(metadata.format ?? "") || !metadata.hasAlpha || (metadata.pages ?? 1) !== 1)
    throw new Error("INVALID_AVATAR_IMAGE");
  return image;
}
/** Bounded, metadata-free map assets; no full-size preview is sent to a public map. */
export async function prepareAvatarSprite(bytes: Buffer): Promise<Buffer> {
  const image = await validateRender(bytes);
  return image.rotate().trim().resize(128, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 }).toBuffer();
}
export async function prepareAvatarRenditions(bytes: Buffer): Promise<AvatarRenditions> {
  const image = await validateRender(bytes);
  const [sprite, detail, preview] = await Promise.all([
    prepareAvatarSprite(bytes),
    image.clone().rotate().trim().resize(256, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100 }).toBuffer(),
    // Preserve every source pixel/dimension after orientation, including facial detail.
    image.clone().rotate().webp({ lossless: true }).toBuffer(),
  ]);
  if (preview.length > 10_000_000) throw new Error("INVALID_AVATAR_IMAGE");
  return { sprite, detail, preview };
}

export function assignMapAvatar(db: Db, principal: string, sprite: Buffer, enabled = false, assets?: Pick<AvatarRenditions, "detail" | "preview">) {
  if (!db.prepare("SELECT 1 FROM university_accounts WHERE principal_id=?").get(principal))
    throw new Error("AVATAR_ACCOUNT_NOT_FOUND");
  db.prepare(`INSERT INTO account_map_avatars(principal_id,asset_id,sprite,enabled,assigned_at,detail,preview) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(principal_id) DO UPDATE SET asset_id=excluded.asset_id,sprite=excluded.sprite,
      enabled=excluded.enabled,assigned_at=excluded.assigned_at,detail=excluded.detail,preview=excluded.preview`)
    .run(principal, randomBytes(16).toString("hex"), sprite, Number(enabled), new Date().toISOString(), assets?.detail ?? null, assets?.preview ?? null);
  return readMapAvatar(db, principal);
}
