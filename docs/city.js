import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const PALETTE = { night: 0x09141e, road: 0x172d3d, ground: 0x10232f, sidewalk: 0x294450,
  wall: 0x25465a, cream: 0xf6d8ad, roof: 0x172735, mint: 0x77e1d1, neon: 0xff9971, gold: 0xf5cf76 };
const overlay = document.body.classList.contains('overlay');
const staticMode = document.body.dataset.mode === 'static';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (new URLSearchParams(location.search).get('full') === '1') document.body.classList.add('full');
const $ = id => document.getElementById(id);
const viewport = $('viewport'), scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 300);
camera.position.set(10, 10, 14);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' }); }
catch { $('scene-error').hidden = false; $('scene-error').textContent = 'WebGL is unavailable. Enable hardware acceleration to explore the city. The building directory remains below.'; }
const controls = renderer ? new OrbitControls(camera, renderer.domElement) : null;
let state = { plots: [], districts: [], jobs: [], hypeTrain: { active: false } }, span = 6, initial = true;
let center = new THREE.Vector3(), bounds = { minX:-4,maxX:4,minZ:-4,maxZ:4 }, layoutKey = '';
const loaded = new Map(), construction = new Map(), effects = [], districts = new Map();
const labelCollections = [loaded, construction, districts], labelPoint = new THREE.Vector3(), trainTangent = new THREE.Vector3();
const environment = new THREE.Group(); scene.add(environment);
const train = new THREE.Group(); scene.add(train);
let trainLevel = -1, track, fetchingSource = 0;
const hemisphere = new THREE.HemisphereLight(0xb2e4e4, 0x26324a, 2.7); scene.add(hemisphere);
const moon = new THREE.DirectionalLight(0xe1e8ff, 2.8); moon.position.set(-8, 14, 8); scene.add(moon);
const warm = new THREE.DirectionalLight(0xffbc94, 1); warm.position.set(7, 5, -5); scene.add(warm);
const materials = new Map();
function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options }));
  return materials.get(key);
}
function box(parent, x,y,z, w,h,d, color, options) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color,options)); mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function seeded(seed) {
  let value = [...seed].reduce((n,ch)=>(Math.imul(n,31)+ch.charCodeAt(0))>>>0,1);
  return ()=>{value=(Math.imul(1664525,value)+1013904223)>>>0;return value/4294967296;};
}
function dispose(group, ownMaterials = false) {
  const local = new Set();
  group.traverse(item=>{item.geometry?.dispose();if(ownMaterials&&item.material)for(const m of Array.isArray(item.material)?item.material:[item.material])local.add(m);});
  local.forEach(m=>{if(![...materials.values()].includes(m))m.dispose();});group.removeFromParent();
}
function tag(text, className = '') {
  const label=document.createElement('div');label.className='name-tag '+className;label.textContent=text;$('labels').append(label);return label;
}
function placeLabels() {
  if (!renderer) return;
  const rect=viewport.getBoundingClientRect(), point=labelPoint;
  for(const collection of labelCollections) for(const item of collection.values()) {
    if(!item?.label)continue;
    point.copy(item.group.position);point.y+=item.tagHeight||1.5;point.project(camera);
    item.label.style.left=`${rect.left+(point.x*.5+.5)*rect.width}px`;
    item.label.style.top=`${rect.top+(-point.y*.5+.5)*rect.height}px`;
    item.label.hidden=point.z < -1 || point.z > 1 || point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1;
  }
}
function fit(reset = false) {
  if(!renderer)return;
  const {width,height}=viewport.getBoundingClientRect();const aspect=width/Math.max(height,1);
  camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;
  camera.updateProjectionMatrix();renderer.setSize(width,height);
  if(reset){camera.zoom=1;camera.position.copy(center).add(new THREE.Vector3(12,12,16));controls.target.copy(center);camera.lookAt(center);camera.updateProjectionMatrix();}
}
function rebuildGround() {
  const plots=state.plots.filter(p=>!['failed','skipped','demolished'].includes(p.status));
  const key=plots.map(p=>`${p.x},${p.z}`).join('|');if(key===layoutKey)return;layoutKey=key;
  for(const child of [...environment.children])dispose(child);
  const xs=plots.map(p=>p.x),zs=plots.map(p=>p.z);
  bounds={minX:Math.min(-3,...xs)-1.2,maxX:Math.max(3,...xs)+1.2,minZ:Math.min(-3,...zs)-1.2,maxZ:Math.max(3,...zs)+1.2};
  const w=bounds.maxX-bounds.minX,d=bounds.maxZ-bounds.minZ,cx=(bounds.maxX+bounds.minX)/2,cz=(bounds.maxZ+bounds.minZ)/2;
  center.set(cx,0.3,cz);span=Math.max(5.2,(w+d)*0.39);
  box(environment,cx,-0.25,cz,w+1.5,0.4,d+1.5,PALETTE.ground);
  box(environment,cx,-0.052,cz,w+1.3,0.02,d+1.3,PALETTE.road);
  for(const plot of plots){
    box(environment,plot.x,-0.035,plot.z,1.22,0.07,1.22,PALETTE.sidewalk);
    box(environment,plot.x,-0.01,plot.z,1.07,0.025,1.07,0x203643);
  }
  // The loop road always surrounds the current city, including raid districts.
  const a=bounds.minX-.35,b=bounds.maxX+.35,c=bounds.minZ-.35,e=bounds.maxZ+.35;
  track=new THREE.CatmullRomCurve3([new THREE.Vector3(a+.6,.12,c),new THREE.Vector3(b-.6,.12,c),new THREE.Vector3(b,.12,c+.6),new THREE.Vector3(b,.12,e-.6),new THREE.Vector3(b-.6,.12,e),new THREE.Vector3(a+.6,.12,e),new THREE.Vector3(a,.12,e-.6),new THREE.Vector3(a,.12,c+.6)],true,'centripetal');
  const rail=new THREE.Mesh(new THREE.TubeGeometry(track,120,.012,4,true),material(PALETTE.mint,{emissive:PALETTE.mint,emissiveIntensity:.4}));environment.add(rail);
  // Street trees and lamps sit between lots; all are engine-owned primitives.
  for(let i=0;i<Math.min(16,Math.ceil(w));i++){
    const x=bounds.minX+.3+i*(w-.6)/Math.max(1,Math.min(16,Math.ceil(w))-1),z=bounds.minZ+.25;
    box(environment,x,.18,z,.045,.36,.045,0x7d6a59);
    const tree=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,6),material(i%2?0x368579:0x4c9a82));tree.position.set(x,.55,z);environment.add(tree);
  }
  fit(true);
}
function dust(plot, collapse = false) {
  if(reducedMotion)return;
  const group=new THREE.Group();group.position.set(plot.x,.05,plot.z);scene.add(group);
  const rng=seeded(plot.id+'dust');const particles=[];
  for(let i=0;i<18;i++){
    const p=box(group,0,0,0,.055,.055,.055,collapse?PALETTE.neon:PALETTE.cream);
    particles.push({p,vx:(rng()-.5)*1.5,vz:(rng()-.5)*1.5,vy:.5+rng()*.65});
  }
  effects.push({group,particles,start:performance.now()/1000});
}
function scaffold(plot) {
  const group=new THREE.Group();group.position.set(plot.x,0,plot.z);scene.add(group);
  const lineMaterial=new THREE.LineBasicMaterial({color:PALETTE.neon,transparent:true,opacity:.75});
  for(let i=0;i<3;i++){
    const wire=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, .45,1)),lineMaterial);wire.position.y=.225+i*.45;group.add(wire);
  }
  const crane=new THREE.Group();crane.position.set(-.45,0,-.4);group.add(crane);
  box(crane,0,.9,0,.09,1.8,.09,PALETTE.mint);
  const arm=new THREE.Group();arm.position.y=1.8;crane.add(arm);
  box(arm,.4,0,0,1.1,.07,.08,PALETTE.mint);box(arm,-.27,-.07,0,.22,.18,.18,PALETTE.neon);
  box(arm,.8,-.3,0,.012,.6,.012,PALETTE.cream);box(arm,.8,-.62,0,.07,.04,.07,PALETTE.neon);
  crane.visible=plot.status==='building';
  return {group,crane,arm,label:tag('@'+plot.author+' · '+(plot.status==='building'?'Codex is building':'awaiting approval'),'pending'),tagHeight:2.1,plot};
}
function addSubscriber(item) {
  if(item.subscriber)return;item.subscriber=true;
  const height=item.tagHeight-.25;
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.48,.025,4,4),material(PALETTE.gold,{emissive:PALETTE.gold,emissiveIntensity:.55}));
  halo.rotation.set(Math.PI/2,0,Math.PI/4);halo.position.y=height;item.group.add(halo);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.26,2.3,12,1,true),new THREE.MeshBasicMaterial({color:PALETTE.gold,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));
  beam.position.y=height+1.15;item.group.add(beam);item.beam=beam;
}
function setTrain() {
  const level=state.hypeTrain?.active?state.hypeTrain.level:0;if(level===trainLevel)return;trainLevel=level;
  for(const child of [...train.children])dispose(child);
  for(let i=0;i<=level&&level>0;i++){
    const car=new THREE.Group();box(car,0,.13,0,.24,.18,.38,i===0?PALETTE.neon:PALETTE.mint);
    box(car,0,.26,.02,.2,.12,.24,PALETTE.roof);
    box(car,0,.27,-.11,.16,.07,.02,PALETTE.cream,{emissive:PALETTE.cream,emissiveIntensity:.5});
    for(const x of [-.13,.13])for(const z of [-.12,.12]){
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.025,8),material(PALETTE.roof));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.045,z);car.add(wheel);
    }
    train.add(car);
  }
}
async function inspect(plot) {
  if(!$('details'))return;
  $('details').hidden=false;$('author').textContent='@'+plot.author;$('description').textContent=plot.prompt;
  $('building-title').textContent=plot.prompt.split(/\s+/).slice(0,6).join(' ');
  $('source').href='./'+plot.file;$('building-code').textContent='Loading module…';
  const request=++fetchingSource;
  try{const response=await fetch('./'+plot.file);if(!response.ok)throw Error('Source unavailable');const code=await response.text();if(request===fetchingSource)$('building-code').textContent=code;}
  catch{if(request===fetchingSource)$('building-code').textContent='Source unavailable. Please refresh the city.';}
}
async function applyState(next) {
  state={jobs:[],districts:[],hypeTrain:{active:false},...next};
  const plots=state.plots.filter(p=>p.status==='built');
  $('count').textContent=`Built by chat: ${plots.length} buildings`;
  if($('building-total'))$('building-total').textContent=plots.length;
  if($('district-total'))$('district-total').textContent=1+state.districts.length;
  $('last').textContent=state.lastAuthor?`Last built by @${state.lastAuthor}`:'14 founding plots. Room for everyone.';
  $('ticker').textContent=state.ticker||'Explore the neighborhood. Every building has a story.';
  const waiting=state.jobs.filter(job=>['moderating','pending','approved','building'].includes(job.status)).sort((a,b)=>b.priority-a.priority);
  if($('queue-size'))$('queue-size').textContent=waiting.length;
  $('queue').replaceChildren(...waiting.slice(0,3).map(job=>{const li=document.createElement('li');li.textContent=`@${job.author} · ${job.status==='building'?'Codex is building':job.status==='approved'?'ready to build':'awaiting approval'}`;return li;}));
  if(!waiting.length){const li=document.createElement('li');li.className='empty-queue';li.textContent=staticMode?'This neighborhood is open to explore.':'Your next viewer could build here.';$('queue').append(li);}
  if($('building-list'))$('building-list').replaceChildren(...plots.map(plot=>{const b=document.createElement('button');b.type='button';b.textContent='@'+plot.author+' / '+plot.prompt.slice(0,40);b.onclick=()=>inspect(plot);return b;}));
  if(!renderer)return;
  rebuildGround();
  for(const [id,item] of loaded){
    const plot=state.plots.find(p=>p.id===id);
    if(!plot||plot.status==='demolished'){
      if(!item.collapseAt){item.collapseAt=performance.now()/1000;dust(item.plot,true);item.label.remove();}
    }else if(plot.upgrades?.includes('subscriber'))addSubscriber(item);
  }
  for(const plot of plots){
    if(loaded.has(plot.id))continue;
    if(!/^city\/buildings\/[a-z0-9_-]+\.js$/i.test(plot.file))continue;
    try{
      const module=await import('./'+plot.file);const group=module.default(THREE,seeded(plot.id));
      group.position.set(plot.x,0,plot.z);group.userData.plot=plot;scene.add(group);
      const box3=new THREE.Box3().setFromObject(group);const height=box3.max.y;
      const fresh=!initial&&!reducedMotion;
      const item={group,plot,update:module.update,label:tag('@'+plot.author,(plot.id.startsWith('seed-')?'seed-tag ':'')+(fresh?'fresh':'')),tagHeight:height+.25,born:fresh?performance.now()/1000:null};
      if(fresh){group.scale.y=.001;dust(plot);}loaded.set(plot.id,item);
      if(plot.upgrades?.includes('subscriber'))addSubscriber(item);
    }catch(error){$('scene-error').hidden=false;$('scene-error').textContent=`Could not load ${plot.id}: ${error.message}`;}
  }
  const activePlots=state.plots.filter(plot=>['pending','building'].includes(plot.status));
  for(const [id,item] of construction)if(!activePlots.some(p=>p.id===id)){dispose(item.group,true);item.label.remove();construction.delete(id);}
  for(const plot of activePlots){
    if(!construction.has(plot.id))construction.set(plot.id,scaffold(plot));
    const item=construction.get(plot.id);item.crane.visible=plot.status==='building';item.label.textContent='@'+plot.author+' · '+(plot.status==='building'?'Codex is building':'awaiting approval');
  }
  for(const district of state.districts){
    if(districts.has(district.id))continue;
    const group=new THREE.Group();group.position.set(district.x,0,district.z-1.15);scene.add(group);
    box(group,-.65,.55,0,.12,1.1,.15,PALETTE.mint);box(group,.65,.55,0,.12,1.1,.15,PALETTE.mint);box(group,0,1.1,0,1.45,.14,.18,PALETTE.neon,{emissive:PALETTE.neon,emissiveIntensity:.5});
    districts.set(district.id,{group,label:tag(district.name,'district-tag'),tagHeight:1.4});
  }
  setTrain();initial=false;
}
async function connect() {
  if(staticMode){
    $('connection').textContent='PUBLIC CITY / NO SIGN-IN';
    try{const response=await fetch('./city/city.json');if(!response.ok)throw Error('City data unavailable');await applyState(await response.json());}
    catch(error){$('scene-error').hidden=false;$('scene-error').textContent=error.message;}
    return;
  }
  const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
  let updates=Promise.resolve();
  socket.onopen=()=>{$('connection').textContent='● LIVE CITY';};
  socket.onmessage=event=>{updates=updates.then(()=>applyState(JSON.parse(event.data))).catch(error=>{$('scene-error').hidden=false;$('scene-error').textContent=error.message;});};
  socket.onclose=()=>{$('connection').textContent='OFFLINE / RECONNECTING';setTimeout(connect,1500);};socket.onerror=()=>socket.close();
}
if(renderer){
  renderer.setClearColor(PALETTE.night,0);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;viewport.append(renderer.domElement);
  controls.target.copy(center);controls.enableDamping=true;controls.enablePan=!overlay;controls.minZoom=.4;controls.maxZoom=5;controls.maxPolarAngle=Math.PI/2.25;
  controls.autoRotate=!reducedMotion;controls.autoRotateSpeed=.5;controls.enabled=!overlay;
  new ResizeObserver(()=>fit()).observe(viewport);
  const start=performance.now()/1000;let last=start;
  renderer.setAnimationLoop(()=>{
    const now=performance.now()/1000,t=now-start,dt=Math.min(.1,now-last);last=now;
    controls.update(dt);
    for(const [id,item] of loaded){
      if(!reducedMotion)item.update?.(item.group,t);
      if(item.born){const p=Math.min(1,(now-item.born)/1.2);item.group.scale.y=1-(1-p)**3;if(now-item.born>8)item.label.classList.remove('fresh');}
      if(item.beam)item.beam.material.opacity=.11+(reducedMotion?0:Math.sin(t*2)*.035);
      if(item.collapseAt){const p=Math.min(1,(now-item.collapseAt)/1.1);item.group.scale.y=1-p;item.group.position.y=-p*.5;item.group.rotation.z=p*.2;if(p>=1){dispose(item.group,true);loaded.delete(id);}}
    }
    if(!reducedMotion)for(const item of construction.values())item.arm.rotation.y=t*.45;
    for(let i=effects.length-1;i>=0;i--){const effect=effects[i],elapsed=now-effect.start;for(const particle of effect.particles){particle.p.position.set(particle.vx*elapsed,particle.vy*elapsed-1.5*elapsed*elapsed,particle.vz*elapsed);particle.p.scale.setScalar(Math.max(0,1-elapsed/1.1));}if(elapsed>1.1){dispose(effect.group);effects.splice(i,1);}}
    if(track&&trainLevel>0){const distance=track.getLength();train.children.forEach((car,i)=>{const pos=((reducedMotion?0:t*.8)/distance-i*.48/distance+10)%1;track.getPointAt(pos,car.position);const direction=track.getTangentAt(pos,trainTangent);car.rotation.y=Math.atan2(direction.x,direction.z);});}
    placeLabels();renderer.render(scene,camera);
  });
  if(!overlay){
    const raycaster=new THREE.Raycaster();let down;
    renderer.domElement.addEventListener('pointerdown',event=>{down=[event.clientX,event.clientY];});
    renderer.domElement.addEventListener('pointerup',event=>{if(!down||Math.hypot(event.clientX-down[0],event.clientY-down[1])>5)return;const rect=viewport.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hit=raycaster.intersectObjects([...loaded.values()].map(i=>i.group),true)[0];let group=hit?.object;while(group&&!group.userData.plot)group=group.parent;if(group)void inspect(group.userData.plot);});
  }
}
$('close-details')?.addEventListener('click',()=>{$('details').hidden=true;});
$('reset-view')?.addEventListener('click',()=>fit(true));
$('orbit-toggle')?.addEventListener('click',event=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;event.currentTarget.textContent=controls.autoRotate?'Pause orbit':'Resume orbit';event.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));});
if(reducedMotion&&$('orbit-toggle')){$('orbit-toggle').textContent='Resume orbit';$('orbit-toggle').setAttribute('aria-pressed','false');}
void connect();
