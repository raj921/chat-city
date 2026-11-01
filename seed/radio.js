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
  box(0.78, 0.73, 0.72, 0, 0.425, 0, wall);
  box(0.88, 0.08, 0.82, 0, 0.83, 0, cream);
  box(0.54, 0.2, 0.035, 0.03, 0.51, 0.38, mint);
  box(0.15, 0.37, 0.035, -0.24, 0.25, 0.38, roof);
  cyl(0.025, 0.04, 0.87, 0, 1.305, 0, gold, 8);
  for (const [r, y] of [[0.15, 1.24], [0.23, 1.49]]) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.015, 5, 20), neon, 0, y, 0); ring.rotation.x = Math.PI / 2;
  }
  ball(0.055, 0, 1.79, 0, mint);
  for (let i = 0; i < 5; i++) box(0.035, 0.07 + i * 0.03, 0.04, -0.1 + i * 0.08, 0.23, 0.4, neon);
  return g;
}
