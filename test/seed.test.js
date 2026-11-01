import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seedCity, spiral } from '../scripts/seed.js';

async function temporaryCity(t) {
  const cityDir = await mkdtemp(path.join(os.tmpdir(), 'chat-city-seed-'));
  t.after(() => rm(cityDir, { recursive: true, force: true }));
  return cityDir;
}

test('all fourteen checked-in buildings pass the real validator before seeding', async t => {
  const cityDir = await temporaryCity(t);
  const result = await seedCity({ cityDir });
  assert.equal(result.validated, 14);
  assert.equal(result.city.plots.length, 14);
  assert.equal(new Set(result.city.plots.map(plot => plot.prompt)).size, 14);
  assert.equal(new Set(result.city.plots.map(plot => `${plot.x},${plot.z}`)).size, 14);
  for (const plot of result.city.plots) {
    assert.equal(plot.status, 'built');
    assert.equal(plot.author, 'chat_city');
    const source = await readFile(path.join(cityDir, 'buildings', `${plot.id}.js`), 'utf8');
    assert.ok(source.includes('export default function build(THREE, rng)'));
  }
});

test('seeding preserves viewer data and does not validate or rewrite cached unchanged seeds', async t => {
  const cityDir = await temporaryCity(t);
  await mkdir(path.join(cityDir, 'buildings'));
  const viewerPlot = { id: 'viewer-1', x: 0, z: 0, author: 'raj921', status: 'built', file: 'city/buildings/viewer-1.js' };
  await writeFile(path.join(cityDir, 'city.json'), JSON.stringify({ plots: [viewerPlot], districts: [],
    jobs: [{ id: 'keep-job', status: 'pending' }], settings: { autoApprove: false }, stream: { id: 'keep-stream' } }));
  let calls = 0;
  const validate = async () => { calls++; return { ok: true, stats: {} }; };
  const first = await seedCity({ cityDir, validate });
  assert.equal(calls, 14);
  assert.equal(first.added, 14);
  assert.equal(first.city.plots.length, 15);
  assert.deepEqual(first.city.plots[0], viewerPlot);
  assert.deepEqual(first.city.jobs, [{ id: 'keep-job', status: 'pending' }]);
  assert.equal(first.city.stream.id, 'keep-stream');
  const file = path.join(cityDir, 'buildings/seed-ramen.js');
  const before = await stat(file);
  const cityBefore = await readFile(path.join(cityDir, 'city.json'), 'utf8');
  const second = await seedCity({ cityDir, validate });
  assert.equal(calls, 14);
  assert.equal(second.skipped, 14);
  assert.equal(second.added, 0);
  assert.equal((await stat(file)).mtimeMs, before.mtimeMs);
  assert.equal(await readFile(path.join(cityDir, 'city.json'), 'utf8'), cityBefore);
  assert.equal(second.city.plots.filter(plot => plot.x === 0 && plot.z === 0).length, 1);
});

test('seeding fails closed on invalid code instead of recording the plot', async t => {
  const cityDir = await temporaryCity(t);
  await assert.rejects(seedCity({ cityDir, validate: async () => ({ ok: false, error: 'Too tall' }) }), /failed validation: Too tall/);
  await assert.rejects(readFile(path.join(cityDir, 'city.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(cityDir, 'buildings/seed-ramen.js')), { code: 'ENOENT' });
});

test('spiral plots stay unique with road space between one-unit footprints', () => {
  const plots = Array.from({ length: 100 }, (_, i) => spiral(i));
  assert.deepEqual(plots.slice(0, 5), [{ x: 0, z: 0 }, { x: 1.5, z: 0 }, { x: 1.5, z: 1.5 }, { x: 0, z: 1.5 }, { x: -1.5, z: 1.5 }]);
  assert.equal(new Set(plots.map(plot => `${plot.x},${plot.z}`)).size, plots.length);
  assert.throws(() => spiral(-1), /nonnegative/);
});
