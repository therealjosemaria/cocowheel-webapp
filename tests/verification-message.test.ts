import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { initializeCoreSchema } from '../server/core';
import { requestUniversityCode, VerificationRateLimitError } from '../server/university-auth';
import { verificationWaitMessage } from '../lib/verification-message';
import { createApiServer } from '../server/index';
import { once } from 'node:events';

test('HTTP cooldown reports Retry-After for the same UniKey without browser cookies', async () => {
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32,8).toString('base64');
  const db = new Database(':memory:'); initializeCoreSchema(db);
  const api = createApiServer(db, {sampleRides:false, sendUniversityCode: async () => {}});
  api.listen(0,'127.0.0.1'); await once(api,'listening');
  const address = api.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const request = () => fetch(`${base}/api/university/code`, {method:'POST', headers:{Origin:'http://localhost:3000','X-Cocowheels-Auth':'1','Content-Type':'application/json'}, body:JSON.stringify({unikey:'abcd1234'})});
    assert.equal((await request()).status,200);
    const blocked = await request();
    assert.equal(blocked.status,429);
    const payload = await blocked.json();
    assert.equal(payload.error,'VERIFICATION_RATE_LIMITED');
    assert.ok(payload.retryAfterSeconds > 0 && payload.retryAfterSeconds <= 60);
    assert.equal(blocked.headers.get('Retry-After'),String(payload.retryAfterSeconds));
  } finally {api.closeAllConnections(); await new Promise<void>(resolve=>api.close(()=>resolve())); db.close();}
});

test('verification wait copy uses remaining time and safe fallback', () => {
  for (const [seconds, text] of [[1,'1 second'],[59,'59 seconds'],[60,'1 minute'],[61,'2 minutes'],[780,'13 minutes'],[3600,'60 minutes']] as const)
    assert.equal(verificationWaitMessage(seconds), `Please try again in ${text}.`);
  for (const value of [undefined, 0, -1, NaN])
    assert.equal(verificationWaitMessage(value),'Please wait a little before trying again.');
});

test('unchanged sending limits expose their actual reset time', async () => {
  process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32,8).toString('base64');
  const db = new Database(':memory:');
  initializeCoreSchema(db);
  const send = async () => {};
  const rejectsAfter = async (now: number, seconds: number) => {
    await assert.rejects(requestUniversityCode(db, 'abcd1234', send, now), (e: unknown) =>
      e instanceof VerificationRateLimitError && e.retryAfterSeconds === seconds);
  };
  try {
    await requestUniversityCode(db,'abcd1234',send,0);
    await rejectsAfter(5000,55);
    await rejectsAfter(59999,1);
    await requestUniversityCode(db,'abcd1234',send,60000);
    await requestUniversityCode(db,'abcd1234',send,120000);
    await rejectsAfter(120001,780);
    await requestUniversityCode(db,'abcd1234',send,900000);
    db.prepare('INSERT OR REPLACE INTO university_limits VALUES (?, ?, ?)').run('send:global',100,3600000);
    await rejectsAfter(960000,2640);
  } finally { db.close(); }
});
