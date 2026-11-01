import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { WebSocket } from 'ws';
import { createApp } from '../server/index.js';

test('live app serves only approved assets, relays chat, requires approval, and rejects unsafe controls',async t=>{
 const cityDir=await mkdtemp(path.join(tmpdir(),'chat-city-server-'));await mkdir(path.join(cityDir,'buildings'));
 await writeFile(path.join(cityDir,'city.json'),JSON.stringify({plots:[],districts:[]}));
 const app=await createApp({cityDir,seed:false,startTwitch:false,moderate:async()=>({allowed:true,skipped:true}),builder:async job=>{
  await writeFile(path.join(cityDir,'buildings',job.id+'.js'),'export default function build(THREE){return new THREE.Group()}');
  return {file:`city/buildings/${job.id}.js`,durationMs:1};
 },log:()=>{}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await app.close();await rm(cityDir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${app.server.address().port}`;
 for(const route of ['/dev','/dashboard','/overlay.html','/city.html','/city.js','/dev.js','/dashboard.js','/style.css','/vendor/three.module.js','/vendor/three.core.js','/vendor/OrbitControls.js']){
  const res=await fetch(base+route);assert.equal(res.status,200,route);assert.ok((await res.text()).length>0,route);
 }
 for(const route of ['/.env','/server/index.js','/city/jobs/private.js','/unknown','/city/buildings/missing.js'])assert.equal((await fetch(base+route)).status,404,route);
 assert.equal((await fetch(base+'/dev',{method:'HEAD'})).status,200);
 assert.equal((await fetch(base+'/%ZZ')).status,400);
 const badHostStatus=await new Promise((resolve,reject)=>{const req=request(base+'/api/state',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 assert.equal(badHostStatus,403);
 const socket=new WebSocket(base.replace('http:','ws:')+'/ws');assert.equal(JSON.parse((await once(socket,'message'))[0]).plots.length,0);
 const post=(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 const next=once(socket,'message');const res=await post('/api/dev/chat',{username:'raj921',message:'!build neon cafe'});assert.equal(res.status,200);
 assert.equal(JSON.parse((await next)[0]).plots[0].author,'raj921');const job=(await res.json()).job;assert.equal(job.status,'pending');
 assert.equal((await post('/api/jobs/approve',{id:job.id})).status,200);
 for(let i=0;i<100;i++){const state=await(await fetch(base+'/api/state')).json();if(state.jobs[0].status==='built')break;await new Promise(r=>setTimeout(r,5));}
 assert.equal(app.queue.city.jobs[0].status,'built');
 assert.equal((await fetch(base+'/'+app.queue.city.plots[0].file)).status,200);
 assert.equal((await post('/api/dev/chat',{username:'a',message:'!build'})).status,400);
 assert.equal((await post('/api/dev/chat',null)).status,400);
 assert.equal((await post('/api/dev/chat',{}, {Origin:'https://evil.example'})).status,403);
 assert.equal((await post('/api/dev/chat',{}, {'Content-Type':'text/plain'})).status,415);
 assert.equal((await post('/api/dev/chat',{message:'x'.repeat(5000)})).status,413);
 assert.equal((await post('/api/settings',{autoApprove:'yes'})).status,400);
 assert.equal((await post('/api/dev/chat',{username:'a',message:'!demolish raj921'})).status,400);
 assert.equal((await post('/api/dev/chat',{username:'mod',isMod:true,message:'!demolish raj921'})).status,200);
 assert.equal(app.queue.city.plots[0].status,'demolished');
});
