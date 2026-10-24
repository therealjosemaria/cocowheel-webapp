import { randomBytes } from "node:crypto";
import sharp from "sharp";
import type { Db } from "./core";
import { reservedUsernames, validUsername } from "../lib/personal-details";

export function initializeProfiles(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_profiles (
    principal_id TEXT PRIMARY KEY REFERENCES guest_sessions(id),
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    photo BLOB, photo_version TEXT
  );
  CREATE TABLE IF NOT EXISTS username_reservations (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    principal_id TEXT NOT NULL REFERENCES guest_sessions(id)
  );`);
  db.transaction(() => {
    const accounts = db
      .prepare(
        "SELECT principal_id, unikey FROM university_accounts ORDER BY verified_at, unikey",
      )
      .all() as { principal_id: string; unikey: string }[];
    for (const account of accounts)
      ensureProfile(db, account.principal_id, account.unikey);
  })();
}
export function ensureProfile(db: Db, principal: string, identity: string) {
  if (
    db
      .prepare("SELECT 1 FROM account_profiles WHERE principal_id=?")
      .get(principal)
  )
    return;
  const base = identity
    .split("@")[0]
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  let username =
    validUsername(base) && !reservedUsernames.has(base) ? base : "rider";
  while (
    db
      .prepare("SELECT 1 FROM username_reservations WHERE username=?")
      .get(username)
  ) {
    username = `${base.slice(0, 3) || "usr"}${randomBytes(3).toString("hex").slice(0, 5)}`;
  }
  db.prepare(
    "INSERT INTO account_profiles(principal_id,username) VALUES (?,?)",
  ).run(principal, username);
  db.prepare("INSERT INTO username_reservations VALUES (?,?)").run(
    username,
    principal,
  );
}
export function publicName(db: Db, principal: string, fallback: string) {
  return (
    (
      db
        .prepare("SELECT username FROM account_profiles WHERE principal_id=?")
        .get(principal) as { username: string } | undefined
    )?.username ?? (fallback.includes("@") ? "rider" : fallback)
  );
}
export function readProfile(db: Db, principal: string, identity: string) {
  const row = db
    .prepare(
      "SELECT username, photo_version FROM account_profiles WHERE principal_id=?",
    )
    .get(principal) as { username: string; photo_version: string | null };
  return {
    username: row.username,
    email:
      identity === "guest"
        ? "mosciarobusiness@gmail.com"
        : identity.includes("@")
          ? identity
          : `${identity}@uni.sydney.edu.au`,
    photoUrl: row.photo_version
      ? `/api/profile-photo/${row.username}?v=${row.photo_version}`
      : null,
  };
}
let processingPhoto = false;
export async function preparePhoto(
  value: unknown,
): Promise<Buffer | undefined> {
  if (value === undefined) return undefined;
  if (
    typeof value !== "string" ||
    value.length > 700_000 ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
  )
    throw new Error("INVALID_PROFILE_PHOTO");
  if (processingPhoto) throw new Error("PHOTO_BUSY");
  processingPhoto = true;
  try {
    const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
    if (bytes.length > 512_000) throw new Error();
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error();
    return await image
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error("INVALID_PROFILE_PHOTO");
  } finally {
    processingPhoto = false;
  }
}
export function saveProfile(
  db: Db,
  principal: string,
  value: unknown,
  photo?: Buffer,
) {
  if (typeof value !== "string") throw new Error("INVALID_USERNAME");
  const username = value.trim().toLowerCase();
  if (!validUsername(username)) throw new Error("INVALID_USERNAME");
  if (reservedUsernames.has(username)) throw new Error("USERNAME_UNAVAILABLE");
  db.transaction(() => {
    const reserved = db
      .prepare(
        "SELECT principal_id FROM username_reservations WHERE username=?",
      )
      .get(username) as { principal_id: string } | undefined;
    if (reserved && reserved.principal_id !== principal)
      throw new Error("USERNAME_UNAVAILABLE");
    db.prepare("INSERT OR IGNORE INTO username_reservations VALUES (?,?)").run(
      username,
      principal,
    );
    db.prepare(
      "UPDATE account_profiles SET username=? WHERE principal_id=?",
    ).run(username, principal);
    if (photo)
      db.prepare(
        "UPDATE account_profiles SET photo=?,photo_version=? WHERE principal_id=?",
      ).run(photo, randomBytes(8).toString("hex"), principal);
  })();
}
