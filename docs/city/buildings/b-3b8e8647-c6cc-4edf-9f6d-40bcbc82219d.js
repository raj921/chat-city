export default function build(THREE, rng) {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({color:0x25465a, roughness:0.8});
  const roof = new THREE.MeshStandardMaterial({color:0x172735, roughness:0.75});
  const cream = new THREE.MeshStandardMaterial({color:0xf6d8ad, roughness:0.65});
  const wood = new THREE.MeshStandardMaterial({color:0x9e6049, roughness:0.8});
  const mint = new THREE.MeshStandardMaterial({color:0x77e1d1, roughness:0.5});
  const coral = new THREE.MeshStandardMaterial({color:0xff9971, emissive:0xff7459, emissiveIntensity:1.8});
  const glass = new THREE.MeshStandardMaterial({color:0xf6d8ad, emissive:0xffb96e, emissiveIntensity:0.65, roughness:0.4});
  const steam = new THREE.MeshStandardMaterial({color:0xd1eee8, transparent:true, opacity:0.5, roughness:1});
  function mesh(geo, mat, x,y,z) {
    const m = new THREE.Mesh(geo,mat); m.position.set(x,y,z); group.add(m); return m;
  }
  function box(w,h,d,mat,x,y,z) { return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z); }
  function cyl(a,b,h,mat,x,y,z,n=12) { return mesh(new THREE.CylinderGeometry(a,b,h,n),mat,x,y,z); }
  function bar(x1,y1,x2,y2,z,mat,r=0.009) {
    const dx=x2-x1,dy=y2-y1;
    const m=cyl(r,r,Math.sqrt(dx*dx+dy*dy),mat,(x1+x2)/2,(y1+y2)/2,z,8);
    m.rotation.z=-Math.atan2(dx,dy); return m;
  }
  box(0.94,0.08,0.9,roof,0,0.04,0);
  box(0.82,0.86,0.72,navy,0,0.51,0.02);
  box(0.86,0.06,0.76,wood,0,0.13,0.02);
  box(0.9,0.085,0.82,roof,0,0.965,0.015);
  box(0.86,0.035,0.78,mint,0,1.025,0.015);
  box(0.8,0.035,0.71,roof,0,1.058,0.015);
  // A warmly lit counter fills the open front.
  box(0.56,0.43,0.025,glass,-0.09,0.53,-0.351);
  box(0.025,0.55,0.045,wood,-0.385,0.515,-0.37);
  box(0.025,0.55,0.045,wood,0.205,0.515,-0.37);
  box(0.59,0.055,0.15,wood,-0.09,0.325,-0.39);
  box(0.54,0.15,0.035,wood,-0.09,0.22,-0.355);
  for(let i=0;i<5;i++) box(0.012,0.13,0.012,cream,-0.31+i*0.11,0.22,-0.379);
  box(0.14,0.56,0.025,roof,0.305,0.43,-0.35);
  box(0.1,0.34,0.018,glass,0.305,0.49,-0.37);
  box(0.014,0.08,0.022,mint,0.348,0.36,-0.39);
  // Three split fabric panels over the serving hatch.
  for(let i=0;i<3;i++) {
    box(0.178,0.17,0.028,mint,-0.285+i*0.19,0.73,-0.393);
    box(0.055,0.014,0.006,cream,-0.285+i*0.19,0.70,-0.411);
  }
  box(0.65,0.035,0.12,roof,-0.07,0.837,-0.38);
  // Two round street stools.
  for(const x of [-0.25,0.08]) {
    cyl(0.065,0.065,0.035,coral,x,0.21,-0.427);
    cyl(0.018,0.025,0.15,roof,x,0.12,-0.427);
    cyl(0.056,0.056,0.018,roof,x,0.049,-0.427);
  }
  // A little bowl and chopsticks on the counter.
  cyl(0.046,0.022,0.037,cream,-0.12,0.371,-0.407);
  cyl(0.037,0.037,0.004,wood,-0.12,0.392,-0.407);
  const chop=box(0.12,0.007,0.008,cream,-0.12,0.405,-0.405); chop.rotation.y=0.35;
  // Rooftop neon: a bowl pictogram framed like a vintage shop sign.
  box(0.56,0.31,0.065,roof,-0.075,1.285,-0.23);
  box(0.59,0.018,0.08,coral,-0.075,1.448,-0.23);
  box(0.59,0.018,0.08,coral,-0.075,1.122,-0.23);
  for(const x of [-0.36,0.21]) box(0.018,0.32,0.08,coral,x,1.285,-0.23);
  for(const x of [-0.26,0.11]) box(0.023,0.09,0.03,wood,x,1.09,-0.21);
  const bowl=mesh(new THREE.TorusGeometry(0.115,0.011,6,20,Math.PI),coral,-0.075,1.285,-0.271);
  bowl.rotation.z=Math.PI;
  bar(-0.205,1.285,0.055,1.285,-0.274,coral);
  bar(-0.12,1.165,-0.03,1.165,-0.274,coral);
  bar(-0.16,1.335,0.035,1.398,-0.274,cream,0.006);
  bar(-0.15,1.315,0.045,1.378,-0.274,cream,0.006);
  for(let i=0;i<2;i++) {
    const x=-0.12+i*0.075;
    bar(x,1.30,x-0.012,1.329,-0.277,coral,0.006);
    bar(x-0.012,1.329,x,1.355,-0.277,coral,0.006);
  }
  // Side glazing and a compact steam flue.
  box(0.022,0.30,0.33,wood,0.419,0.59,0.06);
  box(0.026,0.25,0.27,glass,0.433,0.59,0.06);
  box(0.032,0.014,0.28,cream,0.45,0.59,0.06);
  box(0.032,0.26,0.014,cream,0.45,0.59,0.06);
  cyl(0.075,0.09,0.055,wood,0.24,1.11,0.21);
  cyl(0.045,0.045,0.30,roof,0.24,1.275,0.21);
  cyl(0.075,0.075,0.035,mint,0.24,1.44,0.21);
  const puffs=[];
  for(let i=0;i<3;i++) {
    const p=mesh(new THREE.SphereGeometry(0.055+i*0.012,8,6),steam,0.24-i*0.025,1.54+i*0.13,0.21);
    p.scale.set(0.8,1.3,0.8); puffs.push(p);
  }
  group.userData.puffs=puffs;
  return group;
}
export function update(group,t) {
  group.userData.puffs.forEach((p,i)=>{
    p.position.x=0.24-i*0.025+Math.sin(t*1.2+i)*0.018;
    p.position.y=1.54+i*0.13+Math.sin(t*1.5+i)*0.018;
  });
}
