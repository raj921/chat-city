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
  box(0.55, 0.5, 0.55, 0, 0.31, 0, wall);
  box(0.43, 0.43, 0.43, 0, 0.79, 0, cream);
  box(0.3, 0.39, 0.3, 0, 1.22, 0, wall);
  for (const [r, y] of [[0.45, 0.61], [0.36, 1.06], [0.28, 1.48]]) {
    const eave = cyl(0.06, r, 0.22, 0, y, 0, roof, 4); eave.rotation.y = Math.PI / 4;
    const lip = box(r * 1.42, 0.025, r * 1.42, 0, y - 0.12, 0, gold);
  }
  cyl(0, 0.055, 0.3, 0, 1.74, 0, gold, 8);
  for (const x of [-0.21, 0.21]) {
    box(0.035, 0.49, 0.035, x, 0.31, 0.27, neon);
    ball(0.055, x, 0.49, 0.31, neon);
  }
  return g;
}
