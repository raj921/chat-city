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
  box(0.78, 0.63, 0.73, 0, 0.375, 0, wall);
  box(0.92, 0.1, 0.86, 0, 0.74, 0, roof);
  box(0.53, 0.23, 0.035, 0.06, 0.36, 0.385, mint);
  box(0.13, 0.36, 0.035, -0.27, 0.24, 0.385, roof);
  box(0.56, 0.17, 0.27, 0, 0.96, 0, cream);
  box(0.64, 0.08, 0.3, 0, 1.085, 0, neon);
  for (let i = 0; i < 4; i++) box(0.025, 0.085, 0.31, -0.21 + i * 0.14, 1.087, 0, cream);
  for (const x of [-0.3, 0, 0.3]) {
    cyl(0.055, 0.055, 0.13, x, 0.55, 0.42, neon, 10);
    box(0.02, 0.1, 0.02, x, 0.665, 0.42, cream);
  }
  return g;
}
