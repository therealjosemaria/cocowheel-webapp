// Synthetic read-only-map load data; only call with a separate in-memory/test database.
import type { Db } from '../server/core';
export function seedHomeViewportFixture(db: Db, count=10_000) {
  const now=new Date().toISOString(), future=new Date(Date.now()+86400_000).toISOString();
  const guest=db.prepare('INSERT INTO guest_sessions(id,token_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)');
  const driver=db.prepare(`INSERT INTO rides(id,public_id,status,driver_session_id,driver_alias,origin_latitude,origin_longitude,destination_latitude,destination_longitude,scheduled_departure_at,offer_expires_at,is_sample,price_aud,created_at,last_activity_at) VALUES (?,?,'PUBLISHED',?,'Synthetic driver',?,?,0,0,?,?,0,0,?,?)`);
  const vehicle=db.prepare('INSERT INTO account_vehicles(principal_id,body) VALUES (?,?)');
  const car=JSON.stringify({plate:'SYNTH',make:'Ford',model:'Ranger',year:'2025',colour:'White',selection:{make:'Ford',model:'ford-ranger',year:'2025',colour:'White'}});
  const rider=db.prepare(`INSERT INTO rider_demands(id,owner_id,body,status,created_at,expires_at) VALUES (?,?,?,'OPEN',?,?)`);
  function add(i: number, lat: number, lon: number, role: 'driver'|'rider') {
    const id='viewport-synthetic-'+i; guest.run(id,'fixture-unused-hash-'+i,now,now,future);
    if (role==='driver') { driver.run(id,id,id,lat,lon,future,future,now,now); vehicle.run(id,car); }
    else rider.run(id,id,JSON.stringify({ origin:{latitude:lat,longitude:lon},destination:{latitude:0,longitude:0},date:'any',time:'' }),now,future);
  }
  db.transaction(()=>{
    for (let i=0;i<count;i++) add(i,-55+(i%200)*.1,115+(Math.floor(i/200)%60)*.1,i%2?'driver':'rider');
    // Beyond the old coordinate-ordered cap, including both roles in the same area.
    add(count,-33.923,151.204,'driver'); add(count+1,-33.924,151.205,'rider');
    // An independent second area lets actual pan/zoom requests prove new coverage.
    add(count+2,-37.813,144.963,'driver'); add(count+3,-37.814,144.964,'rider');
  })();
}
