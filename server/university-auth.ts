import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { createGuestSession, findSession, type Db } from "./core";

export const UNIVERSITY_DOMAIN = "uni.sydney.edu.au";
export const ADMIN_UNIKEY = "jmos0905";
const TEST_EMAIL = "mosciarobusiness@gmail.com";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function normalizeUniKey(value: unknown) {
  if (typeof value !== "string") throw new Error("INVALID_UNIKEY");
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z]{4}\d{4}$/.test(normalized) && normalized !== TEST_EMAIL)
    throw new Error("INVALID_UNIKEY");
  return normalized;
}
function codeHash(id: string, code: string) {
  const secret = process.env.COCOWHEELS_CODE_ENCRYPTION_KEY;
  if (!secret) throw new Error("EMAIL_NOT_CONFIGURED");
  return createHmac("sha256", secret)
    .update(`university:${id}:${code}`)
    .digest("hex");
}
function limit(db: Db, key: string, max: number, window: number, now: number) {
  const row = db
    .prepare("SELECT count, reset_at FROM university_limits WHERE bucket = ?")
    .get(key) as { count: number; reset_at: number } | undefined;
  if (row && row.reset_at > now && row.count >= max)
    throw new Error("VERIFICATION_RATE_LIMITED");
  db.prepare("INSERT OR REPLACE INTO university_limits VALUES (?, ?, ?)").run(
    key,
    row && row.reset_at > now ? row.count + 1 : 1,
    row && row.reset_at > now ? row.reset_at : now + window,
  );
}
export type CodeSender = (email: string, code: string) => Promise<void>;
export const sendUniversityEmail: CodeSender = async (email, code) => {
  const key = process.env.COCOWHEELS_RESEND_API_KEY;
  const from = process.env.COCOWHEELS_EMAIL_FROM;
  if (!key || !from) throw new Error("EMAIL_NOT_CONFIGURED");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Cocowheels verification code",
        text: `Your Cocowheels code is ${code}. It expires in 10 minutes. Do not share it. If you did not request this code, ignore this email.`,
      }),
    });
    if (!response.ok) throw new Error("EMAIL_SEND_FAILED");
  } catch {
    throw new Error("EMAIL_SEND_FAILED");
  }
};
export async function requestUniversityCode(
  db: Db,
  value: unknown,
  send: CodeSender = sendUniversityEmail,
  now = Date.now(),
) {
  const unikey = normalizeUniKey(value);
  if (
    send === sendUniversityEmail &&
    (!process.env.COCOWHEELS_RESEND_API_KEY ||
      !process.env.COCOWHEELS_EMAIL_FROM)
  )
    throw new Error("EMAIL_NOT_CONFIGURED");
  const id = randomBytes(24).toString("hex");
  const code = String(randomInt(1000000)).padStart(6, "0");
  const digest = codeHash(id, code);
  db.transaction(() => {
    limit(db, `send:${unikey}`, 3, 15 * 60000, now);
    limit(db, `cooldown:${unikey}`, 1, 60000, now);
    limit(db, "send:global", 100, 60 * 60000, now);
    db.prepare(
      "DELETE FROM university_codes WHERE expires_at <= ? OR unikey = ?",
    ).run(now, unikey);
    db.prepare("DELETE FROM university_limits WHERE reset_at <= ?").run(now);
    db.prepare(
      "INSERT INTO university_codes (id, unikey, code_hash, expires_at) VALUES (?, ?, ?, ?)",
    ).run(id, unikey, digest, now + 10 * 60000);
  })();
  const deliveryAddress =
    unikey === TEST_EMAIL ? unikey : `${unikey}@${UNIVERSITY_DOMAIN}`;
  try {
    await send(deliveryAddress, code);
  } catch (error) {
    db.prepare("DELETE FROM university_codes WHERE id = ?").run(id);
    throw error;
  }
  db.prepare("UPDATE university_codes SET delivered = 1 WHERE id = ?").run(id);
  return { challengeId: id, expiresAt: now + 10 * 60000, deliveryAddress };
}
export function verifyUniversityCode(
  db: Db,
  id: unknown,
  code: unknown,
  previousToken: string | null,
  now = new Date(),
) {
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{48}$/.test(id) ||
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  )
    throw new Error("VERIFICATION_INVALID");
  const challenge = db
    .prepare("SELECT * FROM university_codes WHERE id = ?")
    .get(id) as
    | {
        unikey: string;
        code_hash: string;
        expires_at: number;
        attempts: number;
        delivered: number;
      }
    | undefined;
  if (
    !challenge ||
    !challenge.delivered ||
    challenge.expires_at <= now.getTime() ||
    challenge.attempts >= 5
  )
    throw new Error("VERIFICATION_INVALID");
  limit(db, `verify:${challenge.unikey}`, 15, 15 * 60000, now.getTime());
  db.prepare(
    "UPDATE university_codes SET attempts = attempts + 1 WHERE id = ?",
  ).run(id);
  if (
    !timingSafeEqual(
      Buffer.from(codeHash(id, code), "hex"),
      Buffer.from(challenge.code_hash, "hex"),
    )
  )
    throw new Error("VERIFICATION_INVALID");
  return db.transaction(() => {
    // Consumption and account/session creation are atomic; failed guesses are not rolled back.
    if (
      !db.prepare("DELETE FROM university_codes WHERE id = ?").run(id).changes
    )
      throw new Error("VERIFICATION_INVALID");
    const unikey = challenge.unikey;
    const account = db
      .prepare("SELECT principal_id FROM university_accounts WHERE unikey = ?")
      .get(unikey) as { principal_id: string } | undefined;
    let principal = account?.principal_id;
    if (!principal) {
      principal = createGuestSession(db, now).session.id;
      db.prepare(
        "UPDATE guest_sessions SET anonymous_alias = ? WHERE id = ?",
      ).run(unikey, principal);
    }
    db.prepare(
      "INSERT INTO university_accounts VALUES (?, ?, ?) ON CONFLICT(unikey) DO UPDATE SET verified_at = excluded.verified_at",
    ).run(unikey, principal, now.toISOString());
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM university_sessions WHERE expires_at <= ?").run(
      now.toISOString(),
    );
    db.prepare("INSERT INTO university_sessions VALUES (?, ?, ?, ?)").run(
      hash(token),
      unikey,
      principal,
      new Date(now.getTime() + 30 * 86400000).toISOString(),
    );
    if (previousToken)
      db.prepare("DELETE FROM university_sessions WHERE token_hash = ?").run(
        hash(previousToken),
      );
    return { token, unikey };
  })();
}
export function requireUniversitySession(db: Db, token: string | null) {
  const session = findSession(db, token);
  if (!session?.unikey) throw new Error("UNIVERSITY_VERIFICATION_REQUIRED");
  return session;
}
export function logoutUniversity(db: Db, token: string | null) {
  if (token)
    db.prepare("DELETE FROM university_sessions WHERE token_hash = ?").run(
      hash(token),
    );
}
