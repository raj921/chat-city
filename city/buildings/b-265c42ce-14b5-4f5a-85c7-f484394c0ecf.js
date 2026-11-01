export default function build(THREE, rng) {
  const g = new THREE.Group();
  const mat = (color, glow = 0) => new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: glow, roughness: 0.65});
  const blue = mat(0x25465a), roof = mat(0x172735), cream = mat(0xf6d8ad), mint = mat(0x77e1d1, 0.7), coral = mat(0xff9971, 1.5), glass = mat(0xf6d8ad, 0.5), tea = mat(0xc58d65, 0.25), dark = mat(0x263039);
  function mesh(geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material); m.position.set(x,y,z); g.add(m); return m;
  }
  const box = (w,h,d,m,x,y,z) => mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const cyl = (a,b,h,m,x,y,z,n=16) => mesh(new THREE.CylinderGeometry(a,b,h,n),m,x,y,z);
  function rod(a,b,r,m) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b);
    const s = mesh(new THREE.CylinderGeometry(r,r,p.distanceTo(q),8),m,0,0,0);
    s.position.copy(p).add(q).multiplyScalar(0.5);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),q.sub(p).normalize()); return s;
  }
  box(0.98,0.08,0.96,roof,0,0.04,0);
  box(0.87,0.89,0.77,blue,0,0.525,0.015);
  box(0.92,0.1,0.84,cream,0,1.02,0.015);
  box(0.96,0.09,0.88,roof,0,1.115,0.015);
  // Warm recessed storefront and timber divisions.
  box(0.77,0.56,0.025,glass,0,0.46,0.409);
  for (const x of [-0.39,-0.13,0.13,0.39]) box(0.027,0.65,0.045,roof,x,0.465,0.433);
  box(0.8,0.045,0.05,cream,0,0.17,0.438);
  box(0.8,0.035,0.05,cream,0,0.75,0.438);
  box(0.022,0.13,0.025,cream,0.19,0.41,0.455);
  box(0.8,0.055,0.12,tea,0,0.29,0.425);
  for (const x of [-0.29,0.29]) {
    cyl(0.072,0.072,0.045,coral,x,0.225,0.38);
    cyl(0.018,0.024,0.13,roof,x,0.14,0.38,8);
  }
  // Scalloped striped canopy.
  for (let i=0;i<9;i++) {
    const x=-0.4+i*0.1;
    const a=box(0.099,0.045,0.22,i%2?cream:coral,x,0.82,0.38); a.rotation.x=0.12;
    box(0.099,0.075,0.035,i%2?cream:coral,x,0.775,0.475);
  }
  // Side glazing and softly glowing lanterns.
  box(0.025,0.36,0.39,glass,-0.444,0.52,0.02);
  box(0.03,0.39,0.022,cream,-0.46,0.52,0.02);
  for (const z of [-0.19,0.23]) box(0.03,0.4,0.025,roof,-0.46,0.52,z);
  for (const x of [-0.35,0.35]) {
    rod([x,1,0.37],[x,0.91,0.37],0.009,roof);
    cyl(0.048,0.048,0.12,coral,x,0.94,0.37,12);
    cyl(0.052,0.052,0.015,roof,x,1.007,0.37,12);
  }
  // Rooftop cup: tapered milk tea, oversized lid, straw and pearls.
  cyl(0.3,0.33,0.075,roof,0,1.2,-0.015,24);
  cyl(0.255,0.19,0.65,tea,0,1.56,-0.015,24);
  cyl(0.261,0.248,0.13,cream,0,1.82,-0.015,24);
  cyl(0.287,0.287,0.055,mint,0,1.915,-0.015,24);
  cyl(0.26,0.28,0.05,cream,0,1.962,-0.015,24);
  rod([0.09,1.97,-0.02],[0.21,2.48,-0.05],0.033,coral);
  for (let i=0;i<8;i++) {
    const a=i*Math.PI*2/8;
    mesh(new THREE.SphereGeometry(0.041,8,6),dark,Math.sin(a)*0.187,1.32+(i%2)*0.07,Math.cos(a)*0.187-0.015);
  }
  // Mint badge with a luminous ramen bowl and rising noodle strokes.
  box(0.31,0.245,0.027,roof,0,1.58,0.238);
  const bowl=mesh(new THREE.TorusGeometry(0.089,0.012,6,20,Math.PI),coral,0,1.58,0.261); bowl.rotation.z=Math.PI;
  box(0.2,0.016,0.018,mint,0,1.58,0.266);
  box(0.072,0.013,0.018,coral,0,1.48,0.264);
  rod([-0.04,1.62,0.265],[-0.025,1.68,0.265],0.007,mint);
  rod([0.015,1.62,0.265],[0.033,1.69,0.265],0.007,mint);
  g.userData.neon = coral;
  g.userData.phase = rng()*6.28;
  const light = new THREE.PointLight(0xff9971,0.65,1.6); light.position.set(0,0.75,0.48); g.add(light);
  return g;
}
export function update(group,t) {
  const pulse = Math.sin(t*17+group.userData.phase)*Math.sin(t*29);
  group.userData.neon.emissiveIntensity = pulse>0.72 ? 0.35 : 1.5;
}
