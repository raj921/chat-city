import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createQueue } from '../server/queue.js';
import { moderateDescription } from '../server/moderation.js';

async function waitFor(check) {
  for (let i=0;i<200;i++) { if (check()) return; await new Promise(r=>setTimeout(r,5)); }
  throw Error('Queue did not settle');
}
async function setup(t, options={}) {
 const cityDir=await mkdtemp(path.join(tmpdir(),'chat-city-queue-'));
 const queue=await createQueue({cityDir,builder:async job=>({file:`city/buildings/${job.id}.js`,durationMs:12}),...options,log:()=>{}});
 t.after(async()=>{await queue.close();await rm(cityDir,{recursive:true,force:true});});return {queue,cityDir};
}
test('approval defaults off, viewer reservation is atomic, mods are unlimited and skipping refunds',async t=>{
 const {queue}=await setup(t);
 const one=await queue.enqueue({author:'viewer',prompt:'a cafe'});
 assert.equal(one.status,'pending');assert.equal(queue.active.size,0);
 await assert.rejects(queue.enqueue({author:'viewer',prompt:'another cafe'}),/One building/);
 await queue.enqueue({author:'mod',prompt:'a cafe',privileged:true});
 await queue.enqueue({author:'mod',prompt:'another cafe',privileged:true});
 await queue.skip(one.id);
 assert.equal((await queue.enqueue({author:'viewer',prompt:'new cafe'})).status,'pending');
});
test('at most two builders run, priority jobs go next, failures refund slots and actual attempts stay capped',async t=>{
 let active=0,maxActive=0;const releases=[];
 const {queue}=await setup(t,{maxBuilds:5,builder:job=>new Promise((resolve,reject)=>{
  active++;maxActive=Math.max(maxActive,active);releases.push({job,done:(fail=false)=>{active--;fail?reject(Error('bad geometry')):resolve({file:`city/buildings/${job.id}.js`});}});
 })});
 await queue.setAutoApprove(true);
 for(const [author,priority] of [['first',0],['second',0],['third',0],['vip',2]])await queue.enqueue({author,prompt:'a cafe',priority});
 await waitFor(()=>releases.length===2);assert.equal(maxActive,2);
 releases[0].done(true);await waitFor(()=>releases.length===3);
 assert.equal(releases[2].job.author,'vip');
 releases[1].done();releases[2].done();await waitFor(()=>releases.length===4);releases[3].done();
 await waitFor(()=>queue.active.size===0);assert.equal(queue.city.stream.attempts,4);
 await queue.enqueue({author:'first',prompt:'retry cafe'});await waitFor(()=>releases.length===5);releases[4].done(true);
 await waitFor(()=>queue.active.size===0);
 await assert.rejects(queue.enqueue({author:'sixth',prompt:'cafe'}),/build budget/);
 assert.equal(maxActive,2);
});
test('restart preserves city and limits, pauses pending work, and refunds interrupted jobs without retrying',async t=>{
 const {queue,cityDir}=await setup(t);
 const job=await queue.enqueue({author:'viewer',prompt:'a cafe'});job.status='building';queue.city.stream.attempts=1;
 queue.city.plots[0].status='building';await queue.changed();await queue.close();
 const recovered=await createQueue({cityDir,builder:()=>{throw Error('must not run');},log:()=>{}});t.after(()=>recovered.close());
 assert.equal(recovered.city.jobs[0].status,'failed');assert.equal(recovered.city.stream.viewers.viewer,undefined);
 assert.equal(recovered.city.stream.attempts,1);assert.equal(recovered.city.settings.autoApprove,false);
 assert.equal((await recovered.enqueue({author:'viewer',prompt:'retry'})).status,'pending');
 assert.equal(JSON.parse(await readFile(path.join(cityDir,'city.json'),'utf8')).jobs.length,2);
});
test('raids route only new viewers for ten minutes; subscriber upgrades and credits persist; hype ends',async t=>{
 let clock=1000000;const {queue}=await setup(t,{now:()=>clock});
 await queue.enqueue({author:'regular',prompt:'home'});
 queue.observeChatter('old_chatter');
 const district=await queue.raid('raider');
 queue.observeChatter('hello_first');
 assert.equal((await queue.enqueue({author:'old_chatter',prompt:'old home'})).districtId,undefined);
 assert.equal((await queue.enqueue({author:'hello_first',prompt:'new home'})).districtId,district.id);
 const newcomer=await queue.enqueue({author:'newcomer',prompt:'cafe'});
 assert.equal(newcomer.districtId,district.id);
 const regular=await queue.enqueue({author:'regular',prompt:'home2',privileged:true});assert.equal(regular.districtId,undefined);
 clock+=600001;assert.equal((await queue.enqueue({author:'late',prompt:'home'})).districtId,undefined);
 assert.equal((await queue.subscribe('newcomer')).hasBuilding,true);
 assert.ok(queue.city.plots.find(p=>p.id===newcomer.id).upgrades.includes('subscriber'));
 await queue.subscribe('subviewer');const credited=await queue.enqueue({author:'subviewer',prompt:'golden home'});
 assert.equal(credited.usedCredit,true);assert.ok(credited.priority>0);
 await queue.hype(3);assert.deepEqual(queue.snapshot().hypeTrain,{active:true,level:3});
 await queue.hype(3,false);assert.equal(queue.snapshot().hypeTrain.active,false);
});
test('moderation skips with no key, rejects flagged input and fails closed on service failure',async t=>{
 assert.deepEqual(await moderateDescription('cafe',{apiKey:'',fetchImpl:()=>{throw Error('must not fetch');}}),{allowed:true,skipped:true});
 const mock=async()=>({ok:true,json:async()=>({results:[{flagged:true}]})});
 assert.equal((await moderateDescription('bad',{apiKey:'test-only',fetchImpl:mock})).allowed,false);
 await assert.rejects(moderateDescription('cafe',{apiKey:'test-only',fetchImpl:async()=>({ok:false})}),/unavailable/);
 const {queue}=await setup(t,{moderate:async()=>({allowed:false})});
 await assert.rejects(queue.enqueue({author:'viewer',prompt:'blocked'}),/rejected/);
 assert.equal(queue.city.stream.viewers.viewer,undefined);
});
test('new stream requires an empty queue and resets per-stream budget while keeping city; malformed persistence is preserved',async t=>{
 const {queue,cityDir}=await setup(t);const job=await queue.enqueue({author:'viewer',prompt:'cafe'});
 await assert.rejects(queue.newStream(),/Finish or skip/);await queue.skip(job.id);const old=queue.city.stream.id;
 await queue.newStream();assert.notEqual(queue.city.stream.id,old);assert.equal(queue.city.plots.length,1);
 await queue.close();await writeFile(path.join(cityDir,'city.json'),'{broken');
 await assert.rejects(createQueue({cityDir,builder:()=>{}}));
 assert.equal(await readFile(path.join(cityDir,'city.json'),'utf8'),'{broken');
});
