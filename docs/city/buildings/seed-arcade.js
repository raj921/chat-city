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
  box(0.83, 0.7, 0.75, 0, 0.41, 0, wall);
  box(0.94, 0.12, 0.86, 0, 0.8, 0, roof);
  box(0.74, 0.2, 0.07, 0, 0.7, 0.405, neon);
  for (const x of [-0.21, 0.21]) {
    box(0.24, 0.41, 0.04, x, 0.28, 0.4, mint);
    box(0.16, 0.32, 0.05, x, 0.26, 0.42, roof);
  }
  for (const x of [-0.25, 0, 0.25]) {
    box(0.15, 0.1, 0.08, x, 1.03, 0, mint);
    box(0.21, 0.05, 0.08, x, 0.96, 0, mint);
    for (const dx of [-0.07, 0.07]) box(0.035, 0.06, 0.08, x + dx, 0.9, 0, mint);
    for (const dx of [-0.035, 0.035]) box(0.02, 0.025, 0.085, x + dx, 1.035, 0, roof);
  }
  return g;
}
