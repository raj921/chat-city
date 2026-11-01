export default function build(THREE, rng) {
  const g = new THREE.Group();
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.65, ...extra});
  const blue = mat(0x25465a), roof = mat(0x172735), cream = mat(0xf6d8ad);
  const mint = mat(0x77e1d1), peach = mat(0xff9971);
  const glass = mat(0x183e47, {metalness: 0.35, roughness: 0.2});
  const glow = mat(0xff9971, {emissive: 0xff9971, emissiveIntensity: 0.8});
  const tea = mat(0xf6d8ad, {emissive: 0xff9971, emissiveIntensity: 0.28});
  const pearl = mat(0x3d2737);
  function mesh(geo, m, x, y, z) {
    const a = new THREE.Mesh(geo, m); a.position.set(x,y,z); g.add(a); return a;
  }
  function box(w,h,d,m,x,y,z) {return mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);}
  function ball(r,m,x,y,z) {return mesh(new THREE.SphereGeometry(r,10,6),m,x,y,z);}
  function ring(r,t,m,x,y,z) {
    const a = mesh(new THREE.TorusGeometry(r,t,6,24),m,x,y,z); a.rotation.x = Math.PI/2; return a;
  }
  box(.94,.08,.9,roof,0,.04,0);
  box(.86,.95,.76,cream,0,.555,0);
  box(.89,.12,.8,blue,0,.15,0);
  box(.94,.12,.86,blue,0,1.06,0);
  box(.98,.055,.9,mint,0,1.145,0);
  box(.84,.045,.75,roof,0,1.19,0);
  // Deep glazed shopfront and narrow brass-colored frames.
  box(.43,.53,.025,glass,-.185,.515,.389);
  box(.23,.69,.03,glass,.235,.435,.39);
  for (const x of [-.414,.044,.365]) box(.025,.73,.045,blue,x,.48,.414);
  box(.45,.025,.045,mint,-.185,.245,.415);
  box(.45,.025,.045,mint,-.185,.785,.415);
  box(.022,.53,.045,cream,-.18,.515,.417);
  box(.021,.1,.022,peach,.305,.44,.425);
  box(.2,.035,.1,roof,.235,.105,.445);
  box(.025,.29,.025,cream,-.34,.53,.425).rotation.z = -.12;
  // A little glowing menu behind the glazing.
  box(.12,.19,.018,cream,-.295,.55,.41);
  for(let i=0;i<3;i++) box(.075,.012,.012,peach,-.295,.6-i*.045,.425);
  // Striped canvas canopy, with a scalloped-looking valance.
  for(let i=0;i<8;i++) {
    const x = -.385+i*.11;
    const a = box(.11,.035,.24,i%2 ? cream : mint,x,.846,.37);
    a.rotation.x = .16;
    box(.11,.075,.025,i%2 ? cream : mint,x,.795,.481);
  }
  box(.64,.15,.035,roof,0,.992,.438);
  // Three pearls and a tiny cup make a geometric shop emblem.
  for(let i=0;i<3;i++) ball(.023,glow,-.19+i*.075,.99,.465);
  mesh(new THREE.CylinderGeometry(.039,.027,.075,12),mint,.155,.986,.45);
  box(.009,.065,.009,glow,.167,1.047,.465).rotation.z = -.25;
  // Side glazing and a low outdoor bench.
  box(.022,.43,.43,blue,.439,.57,-.02);
  box(.025,.36,.36,glass,.453,.57,-.02);
  box(.025,.025,.37,mint,.47,.57,-.02);
  box(.025,.38,.025,mint,.47,.57,-.02);
  box(.29,.045,.13,peach,-.27,.23,.405);
  for(const x of [-.37,-.17]) box(.035,.14,.08,blue,x,.145,.405);
  // Oversized luminous milk-tea beacon.
  mesh(new THREE.CylinderGeometry(.235,.17,.65,24),tea,0,1.60,0);
  ring(.175,.016,peach,0,1.285,0);
  ring(.237,.022,mint,0,1.925,0);
  mesh(new THREE.CylinderGeometry(.25,.25,.045,24),cream,0,1.96,0);
  ring(.248,.012,glow,0,1.976,0);
  // The pearls sit on the outer face so the silhouette reads from the street.
  for(let i=0;i<9;i++) {
    const a = i*2.399;
    const y = 1.36 + (i%3)*.067;
    const r = .183+(y-1.36)*.10;
    ball(.036,pearl,Math.sin(a)*r,y,Math.cos(a)*r);
  }
  const straw = mesh(new THREE.CylinderGeometry(.032,.032,.52,12),mint,.09,2.20,0);
  straw.rotation.z = -.25;
  const tip = mesh(new THREE.CylinderGeometry(.023,.023,.004,12),roof,.154,2.452,0);
  tip.rotation.z = -.25;
  // A small heart-like pair of bubbles on the cup.
  ball(.044,glow,-.043,1.73,.218);
  ball(.044,glow,.033,1.73,.218);
  const heart = box(.075,.075,.018,glow,-.005,1.694,.224); heart.rotation.z = Math.PI/4;
  const light = new THREE.PointLight(0xff9971,.65,2); light.position.set(0,1.85,.3); g.add(light);
  return g;
}
