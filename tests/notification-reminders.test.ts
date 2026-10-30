import { rideUpdates } from "../lib/ride-updates";
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { initializeCoreSchema, createGuestSession, findSession, getRide, publishRide, requestRide, decideRequest, cancelRide } from "../server/core";
import { sendMessage, markMessagesRead, stopMessages } from "../server/messaging";
import { offerDemand, postDemand, respondToDemandOffer, withdrawDemandOffer } from "../server/rider-demands";
import { reviewedNotifications, reviewNotifications } from "../server/notification-outbox";
import { deliverJourneyReminder, journeyReminderContent } from "../server/notification-email";
import { createApiServer } from "../server/index";

process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
const now = new Date("2026-10-30T00:00:00Z");
const origin = { latitude: -33.90, longitude: 151.18, label: "Synthetic start" };
const destination = { latitude: -33.86, longitude: 151.22, label: "Synthetic end" };
const later = (ms: number) => new Date(+now + ms);
function setup() {
  const db = new Database(":memory:"); initializeCoreSchema(db);
  function account(name: string) {
    const guest = createGuestSession(db, now);
    const token = `verified-${name}`;
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(name, guest.session.id, now.toISOString());
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(createHash("sha256").update(token).digest("hex"), name, guest.session.id, "2099-01-01T00:00:00Z");
    return { token, session: findSession(db, token, now)! };
  }
  const driver=account("driver@example.com"), rider=account("rider@example.com"), other=account("other@example.com");
  const published=publishRide(db,driver.token,{origin,destination,scheduledDepartureAt:later(3_600_000).toISOString(),priceAud:0},now);
  const ride=published.ride.rideId;
  const join=() => requestRide(db,rider.token,ride,{pickup:origin,destination,requestedDepartureAt:later(3_600_000).toISOString()},now).ride.request!.requestId;
  return { db,driver,rider,other,ride,join };
}
const jobs=(db: Database.Database) => db.prepare("SELECT * FROM journey_notifications ORDER BY created_at,id").all() as Array<{id:string;principal_id:string;event_key:string;kind:string;status:string;attempts:number}>;

test("unreviewed rider request emails the driver once after five minutes, including across reinitialization", async () => {
  const f=setup();try {
    f.join();
    assert.equal(rideUpdates({ role:"DRIVER", ride:getRide(f.db,f.ride,f.driver.session,now) })[0].key,jobs(f.db)[0].event_key);
    const sent: unknown[]=[];
    await deliverJourneyReminder(f.db,async email=>{sent.push(email);},later(299_999)); assert.equal(sent.length,0);
    await deliverJourneyReminder(f.db,async email=>{sent.push(email);},later(300_000)); assert.equal(sent.length,1);
    const email=sent[0] as {to:string[];text:string;subject:string};
    assert.deepEqual(email.to,["driver@example.com"]); assert.match(email.subject,/rider requested/);
    assert.match(email.text,/\/activity\/.+#request-/); assert.doesNotMatch(email.text,/Synthetic|latitude|PayID/);
    initializeCoreSchema(f.db);
    await deliverJourneyReminder(f.db,async email=>{sent.push(email);},later(600_000)); assert.equal(sent.length,1);
  } finally {f.db.close();}
});
test("review acknowledgements are owner scoped, persistent, and cancel the delayed reminder", async () => {
  const f=setup();try {
    f.join(); const job=jobs(f.db)[0];
    reviewNotifications(f.db,f.other.session.id,[job.event_key],later(200_000)); assert.equal(jobs(f.db)[0].status,"PENDING");
    reviewNotifications(f.db,f.driver.session.id,[job.event_key],later(299_999));
    assert.deepEqual(reviewedNotifications(f.db,f.driver.session.id),[job.event_key]);
    assert.deepEqual(reviewedNotifications(f.db,f.other.session.id),[]);
    await deliverJourneyReminder(f.db,async()=>{assert.fail("reviewed notification must not send");},later(300_000));
    for (const invalid of [null,[123],Array(501).fill("key"),["x".repeat(201)]]) assert.throws(()=>reviewNotifications(f.db,f.driver.session.id,invalid),/INVALID_NOTIFICATION_REVIEW/);
  } finally {f.db.close();}
});
test("acceptance resolves the driver reminder and creates a separate unread rider update", async () => {
  const f=setup();try {
    const request=f.join(); decideRequest(f.db,f.driver.token,f.ride,request,"ACCEPT",later(1_000));
    assert.equal(rideUpdates({ role:"RIDER", ride:getRide(f.db,f.ride,f.rider.session,later(1_000)) })[0].key,jobs(f.db).find(job=>job.kind==="ACCEPTED")!.event_key);
    const sent: string[]=[];
    await deliverJourneyReminder(f.db,async email=>{sent.push(email.subject);},later(301_000));
    await deliverJourneyReminder(f.db,async email=>{sent.push(email.subject);},later(301_000));
    assert.deepEqual(sent,["Your request to join was accepted"]);
    assert.equal(jobs(f.db).find(job=>job.kind==="REQUEST")!.status,"SKIPPED");
  } finally {f.db.close();}
});
test("a reviewed accepted request and a cancelled journey never send stale reminders", async () => {
  for (const cancel of [true,false]) {
    const f=setup();try {
      const request=f.join(); decideRequest(f.db,f.driver.token,f.ride,request,"ACCEPT",later(1_000));
      if(cancel) cancelRide(f.db,f.driver.token,f.ride,later(2_000));
      else reviewNotifications(f.db,f.rider.session.id,[jobs(f.db).find(job=>job.kind==="ACCEPTED")!.event_key],later(2_000));
      for(let i=0;i<2;i++) await deliverJourneyReminder(f.db,async()=>assert.fail("resolved update"),later(301_000));
    }finally{f.db.close();}
  }
});
test("consecutive unread messages share one reminder; reading on another device cancels it", async () => {
  const f=setup();try {
    const request=f.join(); reviewNotifications(f.db,f.driver.session.id,[jobs(f.db)[0].event_key],now);
    const first=sendMessage(f.db,f.ride,request,f.rider.session.id,"Private hello","notification-msg-0001",later(1_000));
    sendMessage(f.db,f.ride,request,f.rider.session.id,"Private followup","notification-msg-0002",later(2_000));
    assert.equal(jobs(f.db).filter(job=>job.kind==="MESSAGE").length,1);
    markMessagesRead(f.db,f.ride,request,f.driver.session.id,first.id,later(299_000));
    await deliverJourneyReminder(f.db,async()=>assert.fail("read first unread episode"),later(301_000));
    sendMessage(f.db,f.ride,request,f.rider.session.id,"A new unread message","notification-msg-0003",later(302_000));
    const sent:string[]=[];
    await deliverJourneyReminder(f.db,async email=>{sent.push(email.text);},later(602_000));
    assert.equal(sent.length,1);assert.doesNotMatch(sent[0],/Private|new unread message/);
    await deliverJourneyReminder(f.db,async()=>assert.fail("one reminder per episode"),later(700_000));
  }finally{f.db.close();}
});
test("messages to either role use the same delay and stopped conversations suppress email", async () => {
  for (const stopped of [true,false]) {
    const f=setup();try {
      const request=f.join(); reviewNotifications(f.db,f.driver.session.id,[jobs(f.db)[0].event_key],now);
      sendMessage(f.db,f.ride,request,f.driver.session.id,"Private driver message","notification-msg-0004",now);
      if(stopped) stopMessages(f.db,f.ride,request,f.rider.session.id,later(1_000));
      let sent=0;
      await deliverJourneyReminder(f.db,async email=>{sent++;assert.deepEqual(email.to,["rider@example.com"]);},later(300_000));
      assert.equal(sent,stopped?0:1);
    }finally{f.db.close();}
  }
});
test("both direct offers and replacement proposals notify the rider; withdrawn offers do not", async () => {
  for (const proposal of [true,false]) {
    const f=setup();try {
      const demand=postDemand(f.db,f.rider.token,{origin,destination,date:"any",time:""},now);
      const actor=proposal?f.driver:f.other;
      const offer=offerDemand(f.db,actor.token,demand.id,{scheduledDepartureAt:later(3_600_000).toISOString(),priceAud:0,plate:"ABC123",...(proposal?{replacePostedRideId:f.ride}:{})},now);
      const sent:string[]=[];
      await deliverJourneyReminder(f.db,async email=>{sent.push(email.text);},later(300_000));
      assert.equal(sent.length,1);assert.match(sent[0],new RegExp(`/activity/requests/${demand.id}#offer-${offer.id}`));
      assert.equal(jobs(f.db)[0].status,"SENT");
    }finally{f.db.close();}
  }
  const f=setup();try {
    const demand=postDemand(f.db,f.rider.token,{origin,destination,date:"any",time:""},now);
    const offer=offerDemand(f.db,f.other.token,demand.id,{scheduledDepartureAt:later(3_600_000).toISOString(),priceAud:0,plate:"ABC123"},now);
    withdrawDemandOffer(f.db,f.other.token,offer.id,later(1_000));
    await deliverJourneyReminder(f.db,async()=>assert.fail("withdrawn offer"),later(300_000));
  }finally{f.db.close();}
});
test("a rider accepting a driver's offer does not email the rider about their own action", async () => {
  const f=setup();try {
    const demand=postDemand(f.db,f.rider.token,{origin,destination,date:"any",time:""},now);
    const offer=offerDemand(f.db,f.other.token,demand.id,{scheduledDepartureAt:later(3_600_000).toISOString(),priceAud:0,plate:"ABC123"},now);
    respondToDemandOffer(f.db,f.rider.token,offer.id,"ACCEPT",later(1_000));
    for(let i=0;i<3;i++)await deliverJourneyReminder(f.db,async()=>assert.fail("already resolved by explicit acceptance"),later(301_000));
  }finally{f.db.close();}
});
test("failed sends retry with identical payload and id, stop after three, and skip if reviewed meanwhile", async () => {
  for (const reviewed of [true,false]) {
    const f=setup();try {
      f.join();const calls:Array<{id:string;email:unknown}>=[];
      const fail=async(email:unknown,id:string)=>{calls.push({id,email});throw new Error("ambiguous failure");};
      await deliverJourneyReminder(f.db,fail,later(300_000));
      await deliverJourneyReminder(f.db,fail,later(359_999));assert.equal(calls.length,1);
      if(reviewed)reviewNotifications(f.db,f.driver.session.id,[jobs(f.db)[0].event_key],later(359_999));
      for(const at of [360_000,420_000,480_000])await deliverJourneyReminder(f.db,fail,later(at));
      assert.equal(calls.length,reviewed?1:3);
      assert.ok(calls.every(call=>call.id===calls[0].id && JSON.stringify(call.email)===JSON.stringify(calls[0].email)));
      assert.equal(jobs(f.db)[0].status,reviewed?"REVIEWED":"FAILED");
    }finally{f.db.close();}
  }
});
test("expired jobs never send; notice insert failure rolls back the originating request", async () => {
  const f=setup();try {
    f.join();await deliverJourneyReminder(f.db,async()=>assert.fail("expired notification"),later(6*3_600_000));
    assert.equal(jobs(f.db)[0].status,"SKIPPED");
  }finally{f.db.close();}
  const g=setup();try {
    g.db.exec("CREATE TRIGGER fail_notification BEFORE INSERT ON journey_notifications BEGIN SELECT RAISE(ABORT,'injected-notification-fault'); END");
    assert.throws(g.join,/injected-notification-fault/);
    assert.equal((g.db.prepare("SELECT COUNT(*) AS n FROM ride_requests").get() as {n:number}).n,0);
    assert.equal((g.db.prepare("SELECT status FROM rides WHERE public_id=?").get(g.ride) as {status:string}).status,"PUBLISHED");
  }finally{g.db.close();}
});
test("notification reviews require verified ownership over HTTP and cannot clear someone else's notice", async () => {
  const f=setup(); const server=createApiServer(f.db,{sampleRides:false});server.listen(0,"127.0.0.1");await once(server,"listening");
  const port=(server.address() as {port:number}).port;const url=`http://127.0.0.1:${port}/api/notifications/reviewed`;
  try {
    f.join();const key=jobs(f.db)[0].event_key;
    assert.equal((await fetch(url)).status,401);
    const headers={Authorization:`Bearer ${f.other.token}`,"Content-Type":"application/json"};
    assert.equal((await fetch(url,{method:"POST",headers,body:JSON.stringify({keys:[key]})})).status,200);
    assert.equal(jobs(f.db)[0].status,"PENDING");
    headers.Authorization=`Bearer ${f.driver.token}`;
    assert.equal((await fetch(url,{method:"POST",headers,body:JSON.stringify({keys:[key]})})).status,200);
    assert.deepEqual(await (await fetch(url,{headers})).json(),{keys:[key]});
    assert.equal((await fetch(url,{method:"POST",headers,body:JSON.stringify({keys:[{}]})})).status,400);
  } finally {server.close();await once(server,"close");f.db.close();}
});
test("reminder email uses the shared brand and an encoded private deep link without message content", () => {
  const content=journeyReminderContent("https://www.gumwheel.com","MESSAGE","/activity/example?request=opaque#messages-opaque");
  assert.match(content.html,/width="15" height="15"/);assert.match(content.html,/>GUMWHEEL</);
  assert.match(content.html,/View update/);assert.match(content.text,/https:\/\/www.gumwheel.com\/activity/);
});
