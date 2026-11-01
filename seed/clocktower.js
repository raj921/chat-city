// Codex-assisted checked-in seed. No runtime build timing is claimed.
export default function build(THREE, rng) {
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0x25465a, roughness: 0.8 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x172735, roughness: 0.7 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6d8ad });
  const mint = new THREE.MeshStandardMaterial({ color: 0x77e1d1, emissive: 0x48b8a6, emissiveIntensity: 0.7 });
  const neon = new THREE.MeshStandardMaterial({ color: 0xff9971, emissive: 0xff6847, emissiveIntensity: 1.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xeac66e, metalness: 0.4, roughness: 0.5 });
  function mesh(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); g.add(m); return m;
  }
  function box(w, h, d, x, y, z, material) { return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z); }
  function cyl(rt, rb, h, x, y, z, material, n = 12) { return mesh(new THREE.CylinderGeometry(rt, rb, h, n), material, x, y, z); }
  function ball(r, x, y, z, material) { return mesh(new THREE.SphereGeometry(r, 12, 8), material, x, y, z); }
  box(0.94, 0.06, 0.94, 0, 0.03, 0, roof);
  box(0.61, 1.5, 0.61, 0, 0.81, 0, wall);
  for (const y of [0.35, 0.8, 1.25]) {
    box(0.7, 0.045, 0.7, 0, y, 0, cream);
    box(0.12, 0.16, 0.03, -0.16, y + 0.15, 0.32, mint);
    box(0.12, 0.16, 0.03, 0.16, y + 0.15, 0.32, mint);
  }
  box(0.76, 0.13, 0.76, 0, 1.6, 0, roof);
  const face = cyl(0.2, 0.2, 0.025, 0, 1.36, 0.325, cream, 20);
  face.rotation.x = Math.PI / 2;
  box(0.025, 0.14, 0.035, 0, 1.4, 0.35, roof);
  const hand = box(0.12, 0.025, 0.035, 0.055, 1.36, 0.35, roof);
  hand.rotation.z = 0.35;
  cyl(0, 0.36, 0.52, 0, 1.925, 0, gold, 4);
  ball(0.045, 0, 2.23, 0, neon);
  return g;
}
