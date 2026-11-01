import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exportCity, publicCity } from '../scripts/export.js';

async function fixture(t) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'chat-city-export-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const cityDir = path.join(temporary, 'city'), publicDir = path.join(temporary, 'public'), vendorDir = path.join(temporary, 'vendor');
  await mkdir(path.join(cityDir, 'buildings'), { recursive: true });
  await mkdir(path.join(cityDir, 'jobs/private'), { recursive: true });
  await mkdir(publicDir); await mkdir(vendorDir);
  await writeFile(path.join(cityDir, 'city.json'), JSON.stringify({ plots: [
    { id: 'one', author: '<script>viewer</script>', prompt: 'a cafe', x: 1.5, z: 0, status: 'built', file: 'city/buildings/one.js', secret: 'NEVER_EXPORT_THIS', upgrades: ['subscriber'] },
    { id: 'not-built', status: 'building', file: 'city/buildings/not-built.js' },
    { id: 'escape', status: 'built', file: '../.env' }
  ], districts: [{ id: 'raid-1', name: 'raid district', x: 8, z: 0, secret: 'NEVER_EXPORT_THIS' }],
  jobs: [{ error: 'NEVER_EXPORT_THIS' }], settings: { token: 'NEVER_EXPORT_THIS' }, stream: { viewers: ['private'] } }));
  await writeFile(path.join(cityDir, 'buildings/one.js'), 'export default function build(THREE, rng) { return new THREE.Group(); }');
  await writeFile(path.join(cityDir, 'usage.log'), 'NEVER_EXPORT_THIS');
  await writeFile(path.join(cityDir, 'jobs/private/.env'), 'NEVER_EXPORT_THIS');
  await writeFile(path.join(publicDir, 'city.html'), '<!doctype html><html><head><link href="/style.css"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script></head><body data-mode="live"><nav class="viewer-links"><a href="/dev">Control</a></nav><script type="module" src="/city.js"></script></body></html>');
  await writeFile(path.join(publicDir, 'city.js'), 'const mode = document.body.dataset.mode;');
  await writeFile(path.join(publicDir, 'style.css'), 'body { margin: 0 }');
  await writeFile(path.join(publicDir, 'dashboard.html'), 'NEVER_EXPORT_THIS');
  for (const file of ['three.module.js', 'three.core.js', 'OrbitControls.js']) await writeFile(path.join(vendorDir, file), '// fixture vendor');
  return { temporary, cityDir, publicDir, vendorDir, outDir: path.join(temporary, 'dist'), validate: async () => ({ ok: true }) };
}

test('export contains only validated built plots and assets, with relative URLs for subpath hosting', async t => {
  const options = await fixture(t);
  let validations = 0;
  const result = await exportCity({ ...options, validate: async file => { validations++; assert.equal(path.basename(file), 'one.js'); return { ok: true }; } });
  assert.equal(validations, 1);
  assert.equal(result.count, 1);
  const html = await readFile(path.join(options.outDir, 'index.html'), 'utf8');
  assert.ok(html.includes('data-mode="static"'));
  assert.ok(html.includes('src="./city.js"'));
  assert.ok(html.includes('"three":"./vendor/three.module.js"'));
  assert.ok(!html.includes('/dev'));
  assert.equal(new URL('./city.js', 'https://example.com/chat-city/index.html').pathname, '/chat-city/city.js');
  const city = JSON.parse(await readFile(path.join(options.outDir, 'city/city.json'), 'utf8'));
  assert.equal(city.plots.length, 1);
  assert.deepEqual(city.plots[0].upgrades, ['subscriber']);
  assert.ok(!JSON.stringify(city).includes('NEVER_EXPORT_THIS'));
  assert.equal(city.jobs, undefined);
  assert.equal(city.settings, undefined);
  assert.equal(city.stream, undefined);
  assert.deepEqual((await readdir(path.join(options.outDir, 'city'))).sort(), ['buildings', 'city.json']);
  await assert.rejects(readFile(path.join(options.outDir, 'dashboard.html')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(options.outDir, '.env')), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(options.outDir, 'city/buildings/one.js'), 'utf8'), await readFile(path.join(options.cityDir, 'buildings/one.js'), 'utf8'));
});

test('invalid buildings and unsafe output paths cannot replace an existing export', async t => {
  const options = await fixture(t);
  await exportCity(options);
  const before = await readFile(path.join(options.outDir, 'city/city.json'), 'utf8');
  await assert.rejects(exportCity({ ...options, validate: async () => ({ ok: false, error: 'bad bounds' }) }), /Refusing to export one: bad bounds/);
  assert.equal(await readFile(path.join(options.outDir, 'city/city.json'), 'utf8'), before);
  await assert.rejects(exportCity({ ...options, outDir: options.cityDir }), /replace source/);
  const unrelated = path.join(options.temporary, 'unrelated');
  await mkdir(unrelated); await writeFile(path.join(unrelated, 'keep.txt'), 'keep me');
  await assert.rejects(exportCity({ ...options, outDir: unrelated }), /unmarked nonempty/);
  assert.equal(await readFile(path.join(unrelated, 'keep.txt'), 'utf8'), 'keep me');
});

test('public snapshot uses an allowlist and rejects traversal and pending plots', () => {
  const city = publicCity({ plots: [
    { id: 'good', file: 'city/buildings/good.js', status: 'built', x: Infinity, z: 1, author: 'a', prompt: 'b', token: 'secret' },
    { id: 'bad', file: '../../.env', status: 'built' },
    { id: 'later', file: 'city/buildings/later.js', status: 'pending' }
  ], districts: [], hypeTrain: { active: true, level: 999, token: 'secret' }, token: 'secret' });
  assert.equal(city.plots.length, 1);
  assert.equal(city.plots[0].x, 0);
  assert.equal(city.hypeTrain.level, 100);
  assert.ok(!JSON.stringify(city).includes('secret'));
});
