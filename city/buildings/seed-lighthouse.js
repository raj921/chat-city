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
  cyl(0.23, 0.34, 1.32, 0, 0.72, 0, cream, 16);
  for (const [r, y] of [[0.312, 0.32], [0.284, 0.66], [0.255, 1]]) cyl(r, r, 0.12, 0, y, 0, wall, 16);
  cyl(0.38, 0.38, 0.08, 0, 1.42, 0, roof, 16);
  cyl(0.2, 0.2, 0.3, 0, 1.61, 0, mint, 12);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4; box(0.025, 0.27, 0.025, Math.cos(a) * 0.32, 1.57, Math.sin(a) * 0.32, gold);
  }
  const rail = mesh(new THREE.TorusGeometry(0.32, 0.015, 5, 20), gold, 0, 1.71, 0); rail.rotation.x = Math.PI / 2;
  cyl(0, 0.29, 0.25, 0, 1.895, 0, roof, 12);
  box(0.13, 0.25, 0.03, 0, 0.185, 0.335, wall);
  return g;
}
