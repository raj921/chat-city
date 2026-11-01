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
  for (const [x, h, color] of [[-0.27, 0.93, wall], [0, 1.2, cream], [0.27, 0.8, neon]]) {
    box(0.23, h, 0.62, x, 0.06 + h / 2, -0.04, color);
    for (const y of [0.18, h - 0.06]) box(0.235, 0.035, 0.63, x, y, -0.04, gold);
    box(0.09, 0.23, 0.025, x, 0.52, 0.285, mint);
  }
  box(0.87, 0.07, 0.2, 0, 0.1, 0.35, roof);
  box(0.25, 0.03, 0.13, 0.22, 0.26, 0.36, cream);
  for (const x of [0.12, 0.32]) box(0.025, 0.15, 0.025, x, 0.17, 0.36, roof);
  return g;
}
