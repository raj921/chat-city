import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultValidate = async (file, options) => (await import('../server/validate.js')).validateBuilding(file, options);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function spiral(index) {
  if (!Number.isInteger(index) || index < 0) throw new Error('Plot index must be a nonnegative integer');
  let x = 0, z = 0, dx = 1, dz = 0, run = 1, used = 0, turns = 0;
  for (let i = 0; i < index; i++) {
    x += dx; z += dz;
    if (++used === run) {
      [dx, dz] = [-dz, dx]; used = 0;
      if (++turns % 2 === 0) run++;
    }
  }
  return { x: x * 1.5, z: z * 1.5 };
}

async function regularFile(filename) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular file: ${filename}`);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

// Seed cache is a performance hint, not a security decision. Export revalidates code.
export async function seedCity({ cityDir = path.join(root, 'city'), validate = defaultValidate } = {}) {
  cityDir = path.resolve(cityDir);
  await mkdir(path.join(cityDir, 'buildings'), { recursive: true });
  if ((await lstat(path.join(cityDir, 'buildings'))).isSymbolicLink()) throw new Error('Buildings directory must not be a symlink');
  const manifest = JSON.parse(await readFile(path.join(root, 'seed/manifest.json'), 'utf8'));
  let city;
  try { city = JSON.parse(await readFile(path.join(cityDir, 'city.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; city = { plots: [], districts: [] }; }
  if (!Array.isArray(city.plots) || !Array.isArray(city.districts)) throw new Error('Invalid city.json: expected plots and districts arrays');
  city.seedValidation ??= {};
  let added = 0, validated = 0, skipped = 0;
  const scratch = path.join(cityDir, 'jobs', `seed-check-${randomUUID()}`);
  await mkdir(scratch, { recursive: true });
  try {
    for (const item of manifest) {
      if (!/^seed-[a-z0-9-]+$/.test(item.id) || !/^[a-z0-9-]+\.js$/.test(item.file)) throw new Error('Invalid seed manifest entry');
      const source = path.join(root, 'seed', item.file);
      const bytes = await readFile(source);
      const hash = digest(bytes);
      const target = path.join(cityDir, 'buildings', `${item.id}.js`);
      const exists = await regularFile(target);
      const unchanged = exists && digest(await readFile(target)) === hash;
      if (unchanged && city.seedValidation[item.id] === hash) skipped++;
      else {
        const checkFile = path.join(scratch, `${item.id}.js`);
        await writeFile(checkFile, bytes);
        const result = await validate(checkFile, { cityDir });
        if (!result.ok) throw new Error(`Seed ${item.id} failed validation: ${result.error}`);
        validated++;
        if (!unchanged) {
          const temporary = path.join(cityDir, 'buildings', `.${item.id}-${randomUUID()}.tmp`);
          await copyFile(checkFile, temporary);
          await rename(temporary, target);
        }
        city.seedValidation[item.id] = hash;
      }
      if (!city.plots.some(plot => plot.id === item.id)) {
        let position, index = 0;
        do { position = spiral(index++); }
        while (city.plots.some(plot => plot.x === position.x && plot.z === position.z));
        city.plots.push({ id: item.id, ...position, author: 'chat_city', prompt: item.prompt,
          status: 'built', file: `city/buildings/${item.id}.js`, upgrades: [],
          createdAt: '2026-11-01T00:00:00.000Z' });
        added++;
      }
    }
    const serialized = JSON.stringify(city, null, 2) + '\n';
    let previous;
    try { previous = await readFile(path.join(cityDir, 'city.json'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous !== serialized) {
      const temporary = path.join(cityDir, `.city-seed-${randomUUID()}.tmp`);
      await writeFile(temporary, serialized);
      await rename(temporary, path.join(cityDir, 'city.json'));
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
  return { city, added, validated, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  seedCity().then(result => console.log(`Seeded ${result.added} plots; validated ${result.validated}; reused ${result.skipped} unchanged seeds`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
