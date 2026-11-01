export default function build(THREE, rng) {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0x25465a, roughness: 0.8 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6d8ad });
  const roof = new THREE.MeshStandardMaterial({ color: 0x172735 });
  const neon = new THREE.MeshStandardMaterial({ color: 0xff9971, emissive: 0xff6847, emissiveIntensity: 2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x77e1d1, emissive: 0x48b8a6, emissiveIntensity: 0.8 });
  function box(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  box(0.94, 0.06, 0.94, 0, 0.03, 0, roof);
  box(0.8, 0.75, 0.76, 0, 0.435, 0, wall);
  box(0.93, 0.1, 0.9, 0, 0.86, 0, roof);
  box(0.56, 0.23, 0.035, 0.05, 0.46, 0.397, glass);
  box(0.13, 0.42, 0.04, -0.27, 0.27, 0.398, roof);
  box(0.88, 0.09, 0.22, 0, 0.66, 0.37, cream);
  for (let i = 0; i < 6; i++) box(0.07, 0.1, 0.23, -0.35 + i * 0.14, 0.65, 0.37, neon);
  box(0.58, 0.22, 0.07, 0, 1.05, 0.05, roof);
  const sign = box(0.49, 0.055, 0.08, 0, 1.06, 0.053, neon);
  sign.name = 'neon';
  box(0.035, 0.18, 0.035, -0.2, 0.95, 0.05, cream);
  box(0.035, 0.18, 0.035, 0.2, 0.95, 0.05, cream);
  for (const x of [-0.33, 0.33]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), neon);
    lantern.position.set(x, 0.57, 0.41);
    group.add(lantern);
  }
  const light = new THREE.PointLight(0xff9971, 0.55, 2);
  light.position.set(0, 0.58, 0.47);
  group.add(light);
  return group;
}

export function update(group, t) {
  group.getObjectByName('neon').material.emissiveIntensity = 1.8 + Math.sin(t * 7) * 0.15 + (Math.sin(t * 2.3) > 0.98 ? -1.3 : 0);
}
