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
  box(0.81, 0.89, 0.75, 0, 0.505, 0, wall);
  box(0.89, 0.1, 0.83, 0, 1, 0, cream);
  box(0.83, 0.14, 0.22, 0, 0.58, 0.36, neon);
  for (let i = 0; i < 9; i++) ball(0.018, -0.36 + i * 0.09, 0.53, 0.475, cream);
  box(0.16, 1.35, 0.09, -0.23, 1.02, 0.34, roof);
  for (const y of [0.86, 1.05, 1.24, 1.43]) box(0.1, 0.11, 0.095, -0.23, y, 0.34, mint);
  box(0.2, 0.28, 0.1, 0.22, 0.2, 0.36, gold);
  box(0.12, 0.12, 0.11, 0.22, 0.27, 0.37, mint);
  box(0.29, 0.39, 0.04, -0.08, 0.26, 0.4, roof);
  return g;
}
