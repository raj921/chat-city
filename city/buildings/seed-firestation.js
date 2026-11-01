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
  box(0.84, 0.65, 0.74, 0, 0.385, 0, cream);
  box(0.93, 0.07, 0.84, 0, 0.745, 0, roof);
  for (const x of [-0.21, 0.21]) {
    box(0.3, 0.43, 0.035, x, 0.3, 0.39, neon);
    for (let i = 0; i < 4; i++) box(0.28, 0.015, 0.04, x, 0.17 + i * 0.08, 0.405, cream);
  }
  box(0.24, 1.15, 0.27, -0.23, 0.635, -0.18, wall);
  box(0.3, 0.07, 0.33, -0.23, 1.245, -0.18, roof);
  box(0.1, 0.22, 0.035, -0.23, 1.04, -0.025, mint);
  ball(0.055, 0.22, 0.84, 0, neon);
  return g;
}
