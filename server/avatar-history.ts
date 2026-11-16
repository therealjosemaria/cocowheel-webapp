import sharp from "sharp";
import type { Db } from "./core";
import type { AvatarHistory } from "../lib/avatar-job";
import { AVATAR_PHOTO_TTL, publicAvatarJob, type AvatarJobRow } from "./avatar-jobs";

const PAGE_SIZE = 3;
export function avatarHistory(db: Db, principal: string, value: string | null, now = Date.now()): AvatarHistory {
  const page = value && /^\d{1,6}$/.test(value) ? Number(value) : 0;
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM avatar_jobs WHERE principal_id=?").get(principal) as { total: number };
  const rows = db.prepare(`SELECT id,status,reason,rejection_note,created_at,photo IS NOT NULL AS has_photo
    FROM avatar_jobs WHERE principal_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`)
    .all(principal, PAGE_SIZE, page * PAGE_SIZE) as (AvatarJobRow & { has_photo: number })[];
  return { page, pageSize: PAGE_SIZE, total, items: rows.map(row => ({ ...publicAvatarJob(row),
    thumbnailUrl: row.has_photo && row.created_at > now - AVATAR_PHOTO_TTL
      ? `/api/avatar/history/${row.id}/thumbnail` : null })) };
}
export function ownAvatarHistoryPhoto(db: Db, principal: string, id: string, now = Date.now()): Buffer | null {
  const row = db.prepare("SELECT photo FROM avatar_jobs WHERE id=? AND principal_id=? AND created_at>?")
    .get(id, principal, now - AVATAR_PHOTO_TTL) as { photo: Buffer | null } | undefined;
  return row?.photo ?? null;
}
export async function avatarHistoryThumbnail(photo: Buffer) {
  // Derive small, uncropped previews without a second retained copy of the photo.
  return sharp(photo, { limitInputPixels: 32_000_000, failOn: "warning" })
    .resize({ width: 160, height: 240, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 }).toBuffer();
}
