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

export function avatarSprite(db: Db, assetId: string): Buffer | undefined {
  if (!/^[a-f0-9]{32}$/.test(assetId)) return;
  return (db.prepare("SELECT sprite FROM account_map_avatars WHERE asset_id=? AND enabled=1")
    .get(assetId) as { sprite: Buffer } | undefined)?.sprite;
}

export function ownAvatarSprite(db: Db, principal: string): Buffer | undefined {
  return (db.prepare("SELECT sprite FROM account_map_avatars WHERE principal_id=?")
    .get(principal) as { sprite: Buffer } | undefined)?.sprite;
}

/** Operator-only assignment of an already approved render; never called by an upload endpoint. */
export async function prepareAvatarSprite(bytes: Buffer): Promise<Buffer> {
  if (bytes.length > 10_000_000) throw new Error("INVALID_AVATAR_IMAGE");
  const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (!["png", "webp"].includes(metadata.format ?? "") || !metadata.hasAlpha || (metadata.pages ?? 1) !== 1)
    throw new Error("INVALID_AVATAR_IMAGE");
  // Preserve the full standing figure and alpha; profile-photo square cropping is unsuitable.
  return image.rotate().trim().resize(128, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 }).toBuffer();
}

export function assignMapAvatar(db: Db, principal: string, sprite: Buffer, enabled = false) {
  if (!db.prepare("SELECT 1 FROM university_accounts WHERE principal_id=?").get(principal))
    throw new Error("AVATAR_ACCOUNT_NOT_FOUND");
  db.prepare(`INSERT INTO account_map_avatars(principal_id,asset_id,sprite,enabled,assigned_at) VALUES (?,?,?,?,?)
    ON CONFLICT(principal_id) DO UPDATE SET asset_id=excluded.asset_id,sprite=excluded.sprite,
      enabled=excluded.enabled,assigned_at=excluded.assigned_at`)
    .run(principal, randomBytes(16).toString("hex"), sprite, Number(enabled), new Date().toISOString());
  return readMapAvatar(db, principal);
}
