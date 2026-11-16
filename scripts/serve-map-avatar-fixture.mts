// Local-only browser fixture: separate in-memory SQLite, synthetic accounts/routes.
// Never uses production sessions, trip records, provider credentials or paid generation.
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { initializeCoreSchema, createGuestSession, findSession, publishRide, requestRide } from "../server/core";
import { postDemand } from "../server/rider-demands";
import { assignMapAvatar, prepareAvatarSprite } from "../server/map-avatars";
import { createApiServer } from "../server/index";

if (process.env.GUMWHEEL_AVATAR_FIXTURE !== "1") throw new Error("Local fixture requires GUMWHEEL_AVATAR_FIXTURE=1");
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.COCOWHEELS_FRONTEND_ORIGINS = "http://127.0.0.1:3491";
process.env.COCOWHEELS_ROUTE_ALERTS_ENABLED = "0";
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
const input = process.env.GUMWHEEL_AVATAR_RENDER || "data/tripo-comparison/P2-20260801.png";
assignMapAvatar(db, owner.session.id, await prepareAvatarSprite(await readFile(input)), true);
const origin = { latitude: -33.8923, longitude: 151.1981, label: "Redfern Station" };
const destination = { latitude: -33.8886, longitude: 151.1872, label: "University of Sydney" };
const posted = postDemand(db, owner.token, { origin, destination, date: "any", time: "" });
const ride = publishRide(db, driver.token, { origin, destination, priceAud: 0, scheduledDepartureAt: new Date(Date.now()+3600000).toISOString() }).ride;
requestRide(db, owner.token, ride.rideId, { pickup: origin, destination, requestedDepartureAt: ride.scheduledDepartureAt });
const api = createApiServer(db);
api.listen(3492, "127.0.0.1", () => console.log(JSON.stringify({ requestId: posted.id, rideId: ride.rideId })));
process.on("SIGTERM", () => api.close(() => { db.close(); process.exit(); }));
