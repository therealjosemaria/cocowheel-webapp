import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { once } from "node:events";
import { createApiServer } from "../server/index";
import {
  requestUniversityCode,
  verifyUniversityCode,
  logoutUniversity,
} from "../server/university-auth";
import {
  initializeAdmin,
  provisionAdmin,
  loginAdmin,
  requireAdmin,
  logoutAdmin,
  adminCookie,
  readAdminCookie,
  ADMIN_IDLE_MS,
  ADMIN_MAX_MS,
} from "../server/admin";

test("admin sessions enforce idle and absolute limits independently of reads", () => {
  const db = new Database(":memory:");
  initializeAdmin(db);
  provisionAdmin(db, "tester", "test-only-password");
  const token = loginAdmin(db, "tester", "test-only-password", 0);
  assert.equal(readAdminCookie(adminCookie(token, true)), token);
  assert.match(adminCookie(token, true), /HttpOnly; SameSite=Strict.*Secure/);
  assert.throws(
    () => requireAdmin(db, "guest", false, 1),
    /ADMIN_SESSION_REQUIRED/,
  );
  requireAdmin(db, token, false, ADMIN_IDLE_MS - 1);
  assert.throws(
    () => requireAdmin(db, token, false, ADMIN_IDLE_MS),
    /ADMIN_SESSION_REQUIRED/,
  );
  const second = loginAdmin(db, "tester", "test-only-password", 0);
  for (
    let time = ADMIN_IDLE_MS / 2;
    time < ADMIN_MAX_MS;
    time += ADMIN_IDLE_MS / 2
  )
    requireAdmin(db, second, true, time);
  assert.throws(
    () => requireAdmin(db, second, true, ADMIN_MAX_MS),
    /ADMIN_SESSION_REQUIRED/,
  );
  const third = loginAdmin(db, "tester", "test-only-password", 0);
  logoutAdmin(db, third);
  assert.throws(() => requireAdmin(db, third, false, 1));
  assert.ok(
    !JSON.stringify(db.prepare("SELECT * FROM admin_account").all()).includes(
      "test-only-password",
    ),
  );
  db.close();
});
test("admin login has persisted throttling and no default credentials", () => {
  const db = new Database(":memory:");
  initializeAdmin(db);
  assert.throws(
    () => loginAdmin(db, "admin", "anything", 0),
    /ADMIN_NOT_CONFIGURED/,
  );
  provisionAdmin(db, "tester", "test-only-password");
  for (let i = 0; i < 9; i++)
    assert.throws(
      () => loginAdmin(db, "tester", "wrong", 1),
      /ADMIN_LOGIN_INVALID/,
    );
  assert.throws(
    () => loginAdmin(db, "tester", "test-only-password", 1),
    /ADMIN_RATE_LIMITED/,
  );
  assert.ok(loginAdmin(db, "tester", "test-only-password", 15 * 60_000));
  db.close();
});
test("admin HTTP endpoints protect read-only reports with separate cookies and CSRF checks", async () => {
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
    "base64",
  );
  const db = new Database(":memory:");
  const server = createApiServer(db, { sampleRides: false });
  async function verifiedCookie(unikey: string) {
    let code = "";
    const challenge = await requestUniversityCode(
      db,
      unikey,
      async (_email, value) => {
        code = value;
      },
    );
    const session = verifyUniversityCode(db, challenge.challengeId, code, null);
    return {
      cookie: `cocowheels_guest=${session.token}`,
      token: session.token,
    };
  }
  const owner = await verifiedCookie("jmos0905");
  const student = await verifiedCookie("stud0001");
  const gmail = await verifiedCookie("mosciarobusiness@gmail.com");
  provisionAdmin(db, "tester", "test-only-password");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/admin/`;
  const post = (route: string, cookie = "") =>
    fetch(base + route, {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "X-Admin-Request": "1",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        username: "tester",
        password: "test-only-password",
      }),
    });
  try {
    const unauth = await fetch(base + "dashboard");
    assert.equal(unauth.status, 403);
    assert.match(unauth.headers.get("cache-control")!, /no-store/);
    assert.equal((await fetch(base + "login", { method: "POST" })).status, 403);
    for (const cookie of ["", student.cookie, gmail.cookie]) {
      assert.equal((await post("login", cookie)).status, 403);
    }
    const login = await post("login", owner.cookie);
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { ok: true });
    const adminOnly = login.headers.get("set-cookie")!.split(";")[0];
    const cookie = `${adminOnly}; ${owner.cookie}`;
    for (const identity of ["", student.cookie, gmail.cookie]) {
      assert.equal(
        (
          await fetch(base + "dashboard", {
            headers: { Cookie: `${adminOnly}; ${identity}` },
          })
        ).status,
        403,
      );
    }
    const reports = await fetch(base + "dashboard", {
      headers: { Cookie: cookie },
    });
    assert.equal(reports.status, 200);
    const body = await reports.json();
    assert.deepEqual(body.rides, []);
    assert.equal((await post("rides/anything/cancel", cookie)).status, 404);
    assert.equal((await post("logout", cookie)).status, 200);
    assert.equal(
      (await fetch(base + "dashboard", { headers: { Cookie: cookie } })).status,
      401,
    );
    const nextLogin = await post("login", owner.cookie);
    const nextCookie = `${nextLogin.headers.get("set-cookie")!.split(";")[0]}; ${owner.cookie}`;
    logoutUniversity(db, owner.token);
    assert.equal(
      (await fetch(base + "dashboard", { headers: { Cookie: nextCookie } }))
        .status,
      403,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
