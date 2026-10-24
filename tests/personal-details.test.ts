import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import sharp from "sharp";
import { once } from "node:events";
import {
  initializeCoreSchema,
  findSession,
  publishRide,
  getRide,
} from "../server/core";
import {
  requestUniversityCode,
  verifyUniversityCode,
  logoutUniversity,
} from "../server/university-auth";
import {
  readProfile,
  saveProfile,
  preparePhoto,
} from "../server/personal-details";
import { createApiServer } from "../server/index";
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString(
  "base64",
);
async function login(db: Database.Database, email: string, now = Date.now()) {
  let code = "";
  const challenge = await requestUniversityCode(
    db,
    email,
    async (_, value) => {
      code = value;
    },
    now,
  );
  return verifyUniversityCode(
    db,
    challenge.challengeId,
    code,
    null,
    new Date(now),
  );
}
test("public signup, collisions, rename reservations and stable ownership", async () => {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  try {
    const a = await login(db, "alex@example.com"),
      b = await login(db, "alex@other.com");
    const sa = findSession(db, a.token)!,
      sb = findSession(db, b.token)!;
    assert.notEqual(sa.id, sb.id);
    assert.notEqual(sa.alias, sb.alias);
    assert.ok(/^[a-z0-9]{3,8}$/.test(sb.alias));
    for (const username of [
      "ab",
      "abcdefghi",
      "a_b",
      "a-b",
      "a b",
      "éva",
      "<script>",
    ])
      assert.throws(() => saveProfile(db, sa.id, username), /INVALID_USERNAME/);
    for (const username of ["admin", "support", "official"])
      assert.throws(
        () => saveProfile(db, sa.id, username),
        /USERNAME_UNAVAILABLE/,
      );
    assert.throws(() => saveProfile(db, sb.id, "ALEX"), /USERNAME_UNAVAILABLE/);
    const trip = publishRide(db, a.token, {
      origin: { latitude: -33.88, longitude: 151.18 },
      destination: { latitude: -33.88, longitude: 151.28 },
      scheduledDepartureAt: new Date().toISOString(),
      priceAud: 0,
    });
    saveProfile(db, sa.id, "wwwwwwww");
    assert.equal(findSession(db, a.token)!.id, sa.id);
    assert.equal(getRide(db, trip.ride.rideId, sa).driverAlias, "wwwwwwww");
    assert.throws(() => saveProfile(db, sb.id, "alex"), /USERNAME_UNAVAILABLE/);
    initializeCoreSchema(db);
    assert.equal(readProfile(db, sa.id, a.unikey).username, "wwwwwwww");
    assert.equal(readProfile(db, sa.id, a.unikey).email, "alex@example.com");
    assert.equal(
      (
        db.prepare("SELECT driver_alias FROM rides").get() as {
          driver_alias: string;
        }
      ).driver_alias,
      "alex",
      "historical snapshot preserved",
    );
  } finally {
    db.close();
  }
});
test("Sydney full email and bare UniKey share account, cooldown and admin identity", async () => {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  try {
    const now = Date.now();
    const a = await login(db, "jmos0905", now);
    await assert.rejects(
      login(db, "jmos0905@uni.sydney.edu.au", now + 1000),
      /VERIFICATION_RATE_LIMITED/,
    );
    const b = await login(db, "JMOS0905@uni.sydney.edu.au", now + 61000);
    assert.equal(findSession(db, a.token)!.id, findSession(db, b.token)!.id);
    saveProfile(db, findSession(db, a.token)!.id, "jose123");
    assert.equal(findSession(db, b.token)!.unikey, "jmos0905");
    const impostor = await login(db, "jmos0905@example.com", now);
    assert.notEqual(findSession(db, impostor.token)!.unikey, "jmos0905");
  } finally {
    db.close();
  }
});
test("photos decode, resize, strip metadata and reject unsafe payloads", async () => {
  const input = await sharp({
    create: { width: 1000, height: 800, channels: 3, background: "pink" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const output = await preparePhoto(
    `data:image/jpeg;base64,${input.toString("base64")}`,
  );
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(await preparePhoto(undefined), undefined);
  for (const value of [
    null,
    "",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,AAAA",
    "data:image/png;base64," + "A".repeat(700001),
  ])
    await assert.rejects(preparePhoto(value), /INVALID_PROFILE_PHOTO/);
});
test("legacy profile migration preserves existing sessions and account rows", async () => {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  try {
    const account = await login(db, "abcd1234");
    const before = db.prepare("SELECT * FROM university_accounts").all();
    const sessions = db.prepare("SELECT * FROM university_sessions").all();
    db.exec("DROP TABLE username_reservations; DROP TABLE account_profiles;");
    initializeCoreSchema(db);
    assert.deepEqual(
      db.prepare("SELECT * FROM university_accounts").all(),
      before,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM university_sessions").all(),
      sessions,
    );
    assert.equal(findSession(db, account.token)!.alias, "abcd1234");
    assert.equal(
      readProfile(db, findSession(db, account.token)!.id, account.unikey).email,
      "abcd1234@uni.sydney.edu.au",
    );
  } finally {
    db.close();
  }
});
test("profile HTTP privacy, ownership, atomic failure, photo serving and logout", async () => {
  const db = new Database(":memory:");
  initializeCoreSchema(db);
  const server = createApiServer(db, { sampleRides: false });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const a = await login(db, "first@example.com"),
      b = await login(db, "second@example.com");
    const call = (path: string, token?: string, body?: unknown) =>
      fetch(origin + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await call("/api/profile")).status, 401);
    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "pink" },
    })
      .png()
      .toBuffer();
    let response = await call("/api/profile", a.token, {
      username: "first1",
      photo: `data:image/png;base64,${image.toString("base64")}`,
      principal_id: findSession(db, b.token)!.id,
    });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.email, "first@example.com");
    assert.equal(
      (await (await call("/api/profile", b.token)).json()).username,
      "second",
    );
    response = await call(saved.photoUrl);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      (await call("/api/profile", a.token, { username: "second" })).status,
      409,
    );
    assert.equal(
      (await call("/api/profile", a.token, { username: "third", photo: "bad" }))
        .status,
      400,
    );
    assert.equal(
      (await (await call("/api/profile", a.token)).json()).username,
      "first1",
    );
    assert.equal(
      (await call("/api/profile", a.token, { username: "a".repeat(720000) }))
        .status,
      413,
    );
    logoutUniversity(db, a.token);
    assert.equal((await call("/api/profile", a.token)).status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
