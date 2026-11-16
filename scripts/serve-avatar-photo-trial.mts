// Opt-in photo trial: isolated durable queue, verified test logins, no real mail/spend.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, access, chmod } from "node:fs/promises";
import path from "node:path";

if (process.env.GUMWHEEL_AVATAR_PHOTO_TRIAL !== "1") throw new Error("Set GUMWHEEL_AVATAR_PHOTO_TRIAL=1 for this isolated test.");
const directory = path.resolve(process.env.GUMWHEEL_AVATAR_TRIAL_DIR || "data/avatar-photo-trial");
const dataRoot = path.resolve("data") + path.sep;
if (!directory.startsWith(dataRoot)) throw new Error("Use a private directory beneath ignored data/.");
await mkdir(directory, { recursive: true, mode: 0o700 }); await chmod(directory, 0o700);
const databasePath = path.join(directory, "queue.sqlite");
try { await access(databasePath); throw new Error("Trial database already exists; use a fresh directory."); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
process.env.COCOWHEELS_DB_PATH = databasePath;
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.COCOWHEELS_FRONTEND_ORIGINS = "http://127.0.0.1:3491";
process.env.COCOWHEELS_PUBLIC_ORIGIN = "http://127.0.0.1:3491";
process.env.COCOWHEELS_ROUTE_ALERTS_ENABLED = "0";
process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
process.env.COCOWHEELS_AVATAR_DAILY_CREDITS = "0"; // Review only; no automatic paid task.
process.env.COCOWHEELS_AVATAR_WORKER_KEY = randomBytes(32).toString("hex");
for (const key of ["TRIPO_API_KEY", "COCOWHEELS_TRIPO_CREDENTIALS_FILE", "COCOWHEELS_RESEND_API_KEY", "RESEND_API_KEY", "COCOWHEELS_EMAIL_FROM"]) delete process.env[key];

// Set isolation before importing the API, whose default DB opens at import time.
const { default: db } = await import("../server/db");
const { initializeCoreSchema, createGuestSession } = await import("../server/core");
const { ensureProfile } = await import("../server/personal-details");
const { createApiServer } = await import("../server/index");
initializeCoreSchema(db);
function account(identity: string) {
  const guest = createGuestSession(db), token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(identity, guest.session.id, new Date().toISOString());
  db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), identity, guest.session.id, new Date(Date.now() + 86400_000).toISOString());
  ensureProfile(db, guest.session.id, identity);
  return { token };
}
const users = [1, 2, 3].map(index => account(`photo${index}@example.invalid`));
const admin = account("jmos0905");
await chmod(databasePath, 0o600);
await writeFile(path.join(directory, "context.json"), JSON.stringify({ users, admin }), { mode: 0o600 });
await writeFile(path.join(directory, "worker.json"), JSON.stringify({ origin: "http://127.0.0.1:3496", key: process.env.COCOWHEELS_AVATAR_WORKER_KEY, local_test: true }), { mode: 0o600 });
const api = createApiServer(db, { sendUniversityCode: async () => { throw new Error("Trial uses pre-verified test accounts; no email delivery."); } });
api.listen(3492, "127.0.0.1", () => console.log("Isolated photo trial ready: three verified test logins; generation and real email disabled."));
process.on("SIGTERM", () => api.close(() => { db.close(); process.exit(); }));
