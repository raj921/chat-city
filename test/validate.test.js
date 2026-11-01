import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSource, validateBuilding } from '../server/validate.js';

const valid = `export default function build(THREE, rng) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8,1,0.8),new THREE.MeshStandardMaterial({color:0x25465a}));
  m.position.y=0.5; g.add(m); return g;
}`;
async function fixture(t, source) {
  const cityDir = await mkdtemp(path.join(tmpdir(), 'chat-city-test-'));
  t.after(() => rm(cityDir, { recursive: true, force: true }));
  const file = path.join(cityDir, 'building.js');
  await writeFile(file, source);
  return { file, cityDir };
}

test('static gate accepts the contract and rejects banned and oversized source', () => {
  assert.equal(checkSource(valid), null);
  for (const token of ['fetch("https://example.com")', 'Math.random()', 'Date.now()',
    'new THREE.Texture()', 'new THREE.GLTFLoader()', 'g.constructor', 'await x', 'globalThis.x', '\\u0065val("x")']) {
    assert.match(checkSource(valid + '\n' + token), /Banned token/);
  }
  assert.match(checkSource(' '.repeat(30_000)), /30 KB/);
  assert.match(checkSource('export default () => null'), /build/);
});

test('a fetch building is rejected before any child is started', async t => {
  const { file, cityDir } = await fixture(t, valid + '\nfetch("https://example.com")');
  assert.match((await validateBuilding(file, { cityDir })).error, /fetch/);
});

test('a valid primitive building passes the restricted child', async t => {
  const { file, cityDir } = await fixture(t, valid);
  const result = await validateBuilding(file, { cityDir });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.stats.meshes, 1);
  assert.equal(result.stats.triangles, 12);
  assert.match(result.stats.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(await readFile(file, 'utf8'), valid, 'validation must not alter source');
});

test('an explicit trusted Node executable is probed and unavailable executables never fall back to the parent', async t => {
  const { file, cityDir } = await fixture(t, valid);
  const result = await validateBuilding(file, { cityDir, nodePath: process.env.VALIDATOR_NODE || process.execPath });
  assert.equal(result.ok, true, result.error);
  const missing = await validateBuilding(file, { cityDir, nodePath: path.join(cityDir, 'missing-node') });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /Node executable was not found/);
  const relative = await validateBuilding(file, { cityDir, nodePath: 'node' });
  assert.equal(relative.ok, false);
  assert.match(relative.error, /absolute trusted path/);
});

test('too tall, overbudget, unapproved material, texture and nonfinite geometry fail', async t => {
  const failures = [
    [valid.replace('0.8,1,0.8', '0.8,4,0.8').replace('m.position.y=0.5', 'm.position.y=2'), /height/],
    [valid.replace('g.add(m)', 'for(let i=0;i<81;i++) g.add(m.clone())'), /80/],
    [valid.replace('BoxGeometry(0.8,1,0.8)', 'SphereGeometry(0.4,100,100)'), /6000/],
    [valid.replace('MeshStandardMaterial', 'MeshNormalMaterial'), /Material/],
    [valid.replace('m.position.y=0.5', 'm.position.y=Infinity'), /finite/],
    [valid.replace('g.add(m)', 'g.add(m); g.add(new THREE.DirectionalLight())'), /PointLight/],
    [valid.replace('m.position.y=0.5', 'm.position.y=-0.5'), /Bottom/],
    [valid.replace('BoxGeometry(0.8,1,0.8)', 'BoxGeometry(2,1,0.8)'), /Footprint/],
  ];
  const { file, cityDir } = await fixture(t, valid);
  for (const [source, expected] of failures) {
    await writeFile(file, source);
    const result = await validateBuilding(file, { cityDir });
    assert.equal(result.ok, false);
    assert.match(result.error, expected);
  }
});

test('infinite loops and animation growth are rejected', async t => {
  const { file, cityDir } = await fixture(t, valid.replace('return g;', 'while(true){} return g;'));
  const started = performance.now();
  const result = await validateBuilding(file, { cityDir, timeoutMs: 400 });
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/);
  assert.ok(performance.now() - started < 2500);
  await writeFile(file, valid + '\nexport function update(g,t){g.position.y=t;}');
  const animation = await validateBuilding(file, { cityDir });
  assert.equal(animation.ok, false);
  assert.match(animation.error, /Bottom/);
});

test('the required Node permission model denies native network operations without a network grant', () => {
  const nodePath = process.env.VALIDATOR_NODE || process.execPath;
  const script = `const server=require('node:net').createServer(); server.listen(0,'127.0.0.1',()=>server.close());`;
  const result = spawnSync(nodePath, ['--permission', '--no-warnings', '-e', script], { encoding: 'utf8', timeout: 2000, env: {} });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /ERR_ACCESS_DENIED/);
  assert.match(result.stderr, /--allow-net/);
});
