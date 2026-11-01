import * as THREE from 'three';
import { pathToFileURL } from 'node:url';

const primitives = new Set(['BoxGeometry', 'CapsuleGeometry', 'CircleGeometry', 'ConeGeometry',
  'CylinderGeometry', 'DodecahedronGeometry', 'IcosahedronGeometry', 'OctahedronGeometry',
  'PlaneGeometry', 'PolyhedronGeometry', 'RingGeometry', 'SphereGeometry', 'TetrahedronGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'TubeGeometry', 'LatheGeometry']);
function rng() {
  let seed = 123456789;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function measure(group) {
  if (!(group instanceof THREE.Group)) throw new Error('build() must return a THREE.Group');
  let meshes = 0, triangles = 0, lights = 0, nodes = 0;
  group.updateMatrixWorld(true);
  group.traverse(item => {
    if (++nodes > 200) throw new Error('Too many scene nodes');
    if (!item.matrixWorld.elements.every(Number.isFinite)) throw new Error('Non-finite transform');
    if (item.isLight) {
      if (!item.isPointLight || ++lights > 2) throw new Error('Only two PointLights are allowed');
      if (![item.intensity, item.distance, item.decay, item.color.r, item.color.g, item.color.b].every(Number.isFinite)) throw new Error('Non-finite light');
    } else if (item.isMesh) {
      if (++meshes > 80 || item.isInstancedMesh || item.isSkinnedMesh || item.isBatchedMesh) throw new Error('At most 80 ordinary meshes are allowed');
      const geometry = item.geometry;
      if (!primitives.has(geometry?.type)) throw new Error('Use THREE primitive geometries only');
      if (!geometry.attributes.position) throw new Error('Mesh has no positions');
      for (const attribute of Object.values(geometry.attributes)) {
        if (!Array.from(attribute.array).every(Number.isFinite)) throw new Error('Non-finite geometry');
      }
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      if (triangles > 6000) throw new Error('At most 6000 triangles are allowed');
      for (const material of Array.isArray(item.material) ? item.material : [item.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)) throw new Error('Use MeshStandardMaterial or MeshBasicMaterial only');
        if (Object.values(material).some(value => value?.isTexture)) throw new Error('Textures are not allowed');
        if (Object.values(material).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new Error('Non-finite material');
        for (const color of [material.color, material.emissive].filter(Boolean)) {
          if (![color.r, color.g, color.b].every(Number.isFinite)) throw new Error('Non-finite color');
        }
      }
    } else if (!(item instanceof THREE.Group || item.type === 'Object3D')) throw new Error('Unsupported scene object');
  });
  const bounds = new THREE.Box3().setFromObject(group, true);
  const min = bounds.min.toArray(), max = bounds.max.toArray();
  if (![...min, ...max].every(Number.isFinite) || !meshes) throw new Error('Building must contain visible finite geometry');
  const epsilon = 0.00001;
  if (min[0] < -0.5 - epsilon || max[0] > 0.5 + epsilon || min[2] < -0.5 - epsilon || max[2] > 0.5 + epsilon) throw new Error('Footprint exceeds the centred 1 x 1 plot');
  if (Math.abs(min[1]) > epsilon || max[1] > 3 + epsilon) throw new Error('Bottom must be y=0 and height must be <=3');
  return { meshes, triangles, lights, bounds: { min, max } };
}

try {
  // Recheck inside the selected executable as well, even if a cached parent probe succeeded.
  if (!process.allowedNodeEnvironmentFlags.has('--allow-net') || !process.permission || process.permission.has('net')) {
    throw new Error('Node 25+ with native network access denied is required for validation');
  }
  const module = await import(pathToFileURL(process.argv[2]).href);
  if (typeof module.default !== 'function') throw new Error('Missing default build function');
  if (module.update !== undefined && typeof module.update !== 'function') throw new Error('update must be a function');
  if (Object.keys(module).some(key => !['default', 'update'].includes(key))) throw new Error('Export only build and optional update');
  const group = module.default(THREE, rng());
  if (group?.then) throw new Error('build() cannot be asynchronous');
  const stats = measure(group);
  for (const t of [0, 0.5, 1, 3, 10, 60, 300, 3600]) {
    const result = module.update?.(group, t);
    if (result?.then) throw new Error('update() cannot be asynchronous');
    const sample = measure(group);
    stats.meshes = Math.max(stats.meshes, sample.meshes);
    stats.triangles = Math.max(stats.triangles, sample.triangles);
    stats.lights = Math.max(stats.lights, sample.lights);
  }
  process.stdout.write(JSON.stringify({ ok: true, stats }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error.message + (error.code === 'ERR_ACCESS_DENIED' ? ` Resource: ${error.resource}` : '')).slice(0, 800) }));
}
