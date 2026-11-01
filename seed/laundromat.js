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
  box(0.82, 0.57, 0.73, 0, 0.345, 0, wall);
  box(0.93, 0.08, 0.84, 0, 0.67, 0, mint);
  box(0.73, 0.34, 0.03, 0, 0.32, 0.385, cream);
  for (const x of [-0.24, 0, 0.24]) {
    const ring = mesh(new THREE.TorusGeometry(0.092, 0.025, 6, 14), roof, x, 0.32, 0.415);
    const drum = cyl(0.065, 0.065, 0.025, x, 0.32, 0.417, mint, 14); drum.rotation.x = Math.PI / 2;
  }
  ball(0.13, -0.16, 0.92, 0, mint);
  ball(0.08, 0.1, 1.03, 0, mint);
  ball(0.05, 0.22, 0.86, 0, cream);
  box(0.035, 0.2, 0.035, -0.16, 0.78, 0, cream);
  return g;
}
