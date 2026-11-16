import { randomBytes } from "node:crypto";
import type { Db } from "./core";
import type { AvatarRenditions } from "./map-avatars";

/** Replace only renditions of the same, still-assigned completed result. No lifecycle/event changes. */
export function restoreAvatarPreview(db: Db, id: string, expectedSprite: Buffer, assets: AvatarRenditions) {
  return db.transaction(() => {
    const job = db.prepare("SELECT principal_id,render FROM avatar_jobs WHERE id=? AND status='READY'").get(id) as { principal_id: string; render: Buffer | null } | undefined;
    const current = job && db.prepare("SELECT sprite FROM account_map_avatars WHERE principal_id=?").get(job.principal_id) as { sprite: Buffer } | undefined;
    if (!job?.render?.equals(expectedSprite) || !current?.sprite.equals(expectedSprite) || !assets.sprite.equals(expectedSprite))
      throw new Error("AVATAR_RECOVERY_CHANGED");
    db.prepare("UPDATE account_map_avatars SET asset_id=?,detail=?,preview=? WHERE principal_id=?")
      .run(randomBytes(16).toString("hex"), assets.detail, assets.preview, job.principal_id);
    db.prepare("UPDATE avatar_jobs SET render=? WHERE id=?").run(assets.preview, id);
  })();
}


/** Backfill an operator-assigned avatar from its byte-matched approved local render. */
export function restoreAssignedAvatarPreview(db: Db, principal: string, expectedSprite: Buffer, assets: AvatarRenditions) {
  db.transaction(() => {
    const current=db.prepare("SELECT sprite,preview FROM account_map_avatars WHERE principal_id=?").get(principal) as {sprite:Buffer;preview:Buffer|null}|undefined;
    if (!current || current.preview!==null || !current.sprite.equals(expectedSprite) || !assets.sprite.equals(expectedSprite)) throw new Error("AVATAR_RECOVERY_CHANGED");
    db.prepare("UPDATE account_map_avatars SET asset_id=?,detail=?,preview=? WHERE principal_id=?").run(randomBytes(16).toString("hex"),assets.detail,assets.preview,principal);
  })();
}
