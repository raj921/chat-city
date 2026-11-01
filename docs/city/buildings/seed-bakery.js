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
  box(0.78, 0.64, 0.72, 0, 0.38, 0, cream);
  box(0.89, 0.09, 0.82, 0, 0.745, 0, roof);
  box(0.57, 0.26, 0.035, 0.08, 0.37, 0.38, mint);
  box(0.13, 0.38, 0.035, -0.27, 0.25, 0.38, roof);
  for (let i = 0; i < 7; i++) box(0.12, 0.09, 0.21, -0.36 + i * 0.12, 0.62, 0.38, i % 2 ? cream : neon);
  const croissant = mesh(new THREE.TorusGeometry(0.2, 0.075, 6, 14, Math.PI * 1.45), gold, 0, 1.02, 0);
  croissant.rotation.z = -0.72;
  for (const x of [-0.18, 0, 0.18]) cyl(0.055, 0.055, 0.055, x, 0.25, 0.41, gold);
  return g;
}
