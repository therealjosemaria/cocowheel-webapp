import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { initializeCoreSchema } from '../server/core';
import { homePresenceResponse } from '../server/home-presence';
import { seedHomeViewportFixture } from './seed-home-viewport-fixture.mts';
const db=new Database(':memory:'); initializeCoreSchema(db); seedHomeViewportFixture(db);
const report=[];
for (const [name,query] of [
  ['overview','overview=1'],['sydney','south=-34&north=-33.85&west=151.1&east=151.3&zoom=12'],
  ['melbourne','south=-37.9&north=-37.7&west=144.9&east=145.1&zoom=12'],
  ['empty','south=-30&north=-29&west=150&east=151&zoom=12'],
  ['broad','south=-60&north=-10&west=100&east=160&zoom=7'],
  ['crowded','south=-55&north=-35&west=115&east=121&zoom=8'],
] as const) {
  const times=[]; let result;
  for(let i=0;i<50;i++) { const start=performance.now(); result=homePresenceResponse(db,new URLSearchParams(query)); times.push(performance.now()-start); }
  assert.ok(result); assert.ok(result.cells.reduce((sum,c)=>sum+c.count,0)<=120);
  if(name==='sydney'||name==='melbourne') assert.deepEqual(new Set(result.cells.map(c=>c.role)),new Set(['driver','rider']));
  times.sort((a,b)=>a-b);
  report.push({name,repetitions:50,p95Ms:Number(times[47].toFixed(3)),maxMs:Number(times.at(-1)!.toFixed(3)),bytes:Buffer.byteLength(JSON.stringify(result)),cells:result.cells.length});
}
console.log(JSON.stringify({population:10004,isolation:'in-memory synthetic only; no HTTP, live records, GPS, emails or provider calls',results:report},null,2));db.close();
