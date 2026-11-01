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
  box(0.81, 0.55, 0.75, 0, 0.335, 0, mint);
  for (const x of [-0.4, 0, 0.4]) box(0.035, 0.6, 0.8, x, 0.36, 0, cream);
  const left = box(0.49, 0.035, 0.84, -0.21, 0.74, 0, mint); left.rotation.z = 0.5;
  const right = box(0.49, 0.035, 0.84, 0.21, 0.74, 0, mint); right.rotation.z = -0.5;
  box(0.035, 0.85, 0.035, 0, 0.465, 0.4, cream);
  for (const x of [-0.22, 0.22]) for (const z of [-0.22, 0.22]) {
    cyl(0.07, 0.055, 0.1, x, 0.11, z, wall);
    ball(0.09, x, 0.24, z, gold);
  }
  return g;
}
