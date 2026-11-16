// Local-only browser fixture: separate in-memory SQLite, synthetic accounts/routes.
// Never uses production sessions, trip records, provider credentials or paid generation.
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { runAvatarGeneration } from "../server/avatar-generation";
import { readFile } from "node:fs/promises";
import { initializeCoreSchema, createGuestSession, findSession, publishRide, requestRide } from "../server/core";
import { postDemand } from "../server/rider-demands";
import { assignMapAvatar, prepareAvatarSprite } from "../server/map-avatars";
import { createApiServer } from "../server/index";

if (process.env.GUMWHEEL_AVATAR_FIXTURE !== "1") throw new Error("Local fixture requires GUMWHEEL_AVATAR_FIXTURE=1");
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.COCOWHEELS_FRONTEND_ORIGINS = "http://127.0.0.1:3491";
process.env.COCOWHEELS_ROUTE_ALERTS_ENABLED = "0";
process.env.COCOWHEELS_AVATAR_UPLOADS = "1";
process.env.COCOWHEELS_AVATAR_WORKER_KEY = "synthetic-avatar-worker-key-".repeat(3);
delete process.env.TRIPO_API_KEY;
delete process.env.COCOWHEELS_TRIPO_CREDENTIALS_FILE;
delete process.env.COCOWHEELS_RESEND_API_KEY;
delete process.env.RESEND_API_KEY;
const db = new Database(":memory:");
initializeCoreSchema(db);
function account(name: string, token: string) {
  const guest = createGuestSession(db);
  db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, guest.session.id, new Date().toISOString());
  db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), name, guest.session.id, "2099-01-01T00:00:00Z");
  return { token, session: findSession(db, token)! };
}
const owner = account("tester01", "synthetic-avatar-owner"), driver = account("driver01", "synthetic-avatar-driver");
account("jmos0905", "synthetic-avatar-admin");
const input = process.env.GUMWHEEL_AVATAR_RENDER || "data/tripo-comparison/P2-20260801.png";
const render = await prepareAvatarSprite(await readFile(input));
assignMapAvatar(db, owner.session.id, render, true);
const origin = { latitude: -33.8923, longitude: 151.1981, label: "Redfern Station" };
const destination = { latitude: -33.8886, longitude: 151.1872, label: "University of Sydney" };
const posted = postDemand(db, owner.token, { origin, destination, date: "any", time: "" });
const ride = publishRide(db, driver.token, { origin, destination, priceAud: 0, scheduledDepartureAt: new Date(Date.now()+3600000).toISOString() }).ride;
requestRide(db, owner.token, ride.rideId, { pickup: origin, destination, requestedDepartureAt: ride.scheduledDepartureAt });
const api = createApiServer(db);
api.listen(3492, "127.0.0.1", () => console.log(JSON.stringify({ requestId: posted.id, rideId: ride.rideId })));
// Synthetic fixture controls only: never mounted by the application API.
let fixtureBalance = 1000;
const controls = createServer(async (request, response) => {
  if (request.method !== "POST" || request.headers["x-gumwheel-fixture"] !== "1") { response.writeHead(403); response.end(); return; }
  if (request.url === "/reset") {
    db.prepare("DELETE FROM avatar_jobs WHERE principal_id=?").run(driver.session.id);
    db.prepare("DELETE FROM account_map_avatars WHERE principal_id=?").run(driver.session.id);
  } else if (request.url === "/credits-low") {
    fixtureBalance = 50;
  } else if (request.url === "/credits-ready") {
    fixtureBalance = 1000;
  } else if (request.url === "/generate") {
    // Skip synthetic backoff without creating future-dated notification events.
    db.prepare("UPDATE avatar_jobs SET next_at=0 WHERE status IN ('APPROVED','GENERATING')").run();
    await runAvatarGeneration(db, { request: async path => path === "/account/balance" ? { balance: fixtureBalance } : path === "/files" ? { file_token: "file_fixture" } : path.startsWith("/tasks/") ? { status: "success", output: { rendered_image_url: "https://tripo3d.ai/fixture.png" } } : { task_id: "fixture-task-"+Date.now() }, image: async () => render });
  } else { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": "application/json" }); response.end('{"ok":true}');
});
controls.listen(3494, "127.0.0.1");
process.on("SIGTERM", () => { controls.close(); api.close(() => { db.close(); process.exit(); }); });
