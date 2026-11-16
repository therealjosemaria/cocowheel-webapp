// Explicit local operator action. Does not contact Tripo or generate a model.
import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { assignMapAvatar, initializeMapAvatars, prepareAvatarSprite } from "../server/map-avatars";

const args = process.argv.slice(2);
if (args.length < 2 || args.length > 3 || (args[2] !== undefined && args[2] !== "--enable"))
  throw new Error("Usage: node --import tsx scripts/assign-map-avatar.mts LOGIN_IDENTITY APPROVED_RENDER [--enable]");
const sprite = await prepareAvatarSprite(await fs.readFile(args[1]));
const db = new Database(process.env.COCOWHEELS_DB_PATH || "data/cocowheels.db", { fileMustExist: true });
try {
  db.pragma("foreign_keys = ON");
  const account = db.prepare("SELECT principal_id FROM university_accounts WHERE unikey=?")
    .get(args[0].trim().toLowerCase()) as { principal_id: string } | undefined;
  if (!account) throw new Error("AVATAR_ACCOUNT_NOT_FOUND");
  db.transaction(() => {
    initializeMapAvatars(db);
    assignMapAvatar(db, account.principal_id, sprite, args[2] === "--enable");
  })();
  console.log("Approved map avatar assigned. Source photo and 3D model remain private.");
} finally { db.close(); }
