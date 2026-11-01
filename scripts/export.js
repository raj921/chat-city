import { randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultValidate = async (file, options) => (await import('../server/validate.js')).validateBuilding(file, options);
const marker = '.chat-city-export';
const string = (value, max = 200) => typeof value === 'string' ? value.slice(0, max) : '';
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;

export function publicCity(city) {
  const plots = (city.plots || []).filter(plot => plot.status === 'built' &&
    typeof plot.id === 'string' && /^[a-z0-9-]+$/.test(plot.id) &&
    plot.file === `city/buildings/${plot.id}.js`).map(plot => ({
    id: plot.id, x: number(plot.x), z: number(plot.z), author: string(plot.author, 64),
    prompt: string(plot.prompt), status: 'built', file: plot.file,
    upgrades: Array.isArray(plot.upgrades) ? plot.upgrades.filter(item => ['subscriber', 'gold', 'beam'].includes(item)) : [],
    createdAt: string(plot.createdAt, 40), ...(plot.districtId ? { districtId: string(plot.districtId, 64) } : {})
  }));
  const districts = (city.districts || []).map(district => ({
    id: string(district.id, 64), name: string(district.name, 80), raider: string(district.raider, 25),
    x: number(district.x), z: number(district.z), createdAt: string(district.createdAt, 40),
    expiresAt: typeof district.expiresAt === 'number' ? number(district.expiresAt) : string(district.expiresAt, 40)
  }));
  return { plots, districts, hypeTrain: { active: Boolean(city.hypeTrain?.active),
    level: Math.max(0, Math.min(100, Math.floor(number(city.hypeTrain?.level)))) } };
}

function staticHTML(html) {
  html = html.replace(/<nav\b[^>]*class=["'][^"']*\bviewer-links\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<([a-z][a-z0-9]*)\b[^>]*\bdata-live-only(?:=["'][^"']*["'])?[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<body\b([^>]*)>/i, (_, attrs) => `<body${attrs.replace(/\sdata-mode=["'][^"']*["']/i, '')} data-mode="static">`);
  html = html.replace(/((?:href|src)=["'])\/(?!\/)/g, '$1./');
  html = html.replace(/(["'])\/vendor\//g, '$1./vendor/');
  return html;
}

async function ensureFile(filename) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Export source is not a regular file: ${filename}`);
}

async function safeDestination(outDir) {
  try {
    const stat = await lstat(outDir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Export output must be a directory, not a symlink');
    const files = await readdir(outDir);
    if (files.length && !files.includes(marker)) throw new Error('Refusing to replace an unmarked nonempty export directory');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

export async function exportCity({ cityDir = path.join(root, 'city'), outDir = path.join(root, 'dist'),
  publicDir = path.join(root, 'public'), vendorDir, validate = defaultValidate } = {}) {
  cityDir = path.resolve(cityDir); outDir = path.resolve(outDir); publicDir = path.resolve(publicDir);
  for (const source of [cityDir, publicDir, root]) {
    if (outDir === source || source.startsWith(outDir + path.sep)) throw new Error('Export output would replace source files');
  }
  if (outDir.startsWith(cityDir + path.sep) || outDir.startsWith(publicDir + path.sep)) throw new Error('Export output must be outside the source directories');
  await safeDestination(outDir);
  const city = publicCity(JSON.parse(await readFile(path.join(cityDir, 'city.json'), 'utf8')));
  const validatedFiles = [];
  for (const plot of city.plots) {
    const source = path.join(cityDir, 'buildings', `${plot.id}.js`);
    await ensureFile(source);
    const result = await validate(source, { cityDir });
    if (!result.ok) throw new Error(`Refusing to export ${plot.id}: ${result.error}`);
    validatedFiles.push(source);
  }
  if (!vendorDir) {
    const threeEntry = fileURLToPath(import.meta.resolve('three'));
    const threeDir = path.dirname(path.dirname(threeEntry));
    vendorDir = { module: path.join(threeDir, 'build/three.module.js'), core: path.join(threeDir, 'build/three.core.js'),
      controls: path.join(threeDir, 'examples/jsm/controls/OrbitControls.js'), license: path.join(threeDir, 'LICENSE') };
  } else if (typeof vendorDir === 'string') {
    vendorDir = { module: path.join(vendorDir, 'three.module.js'), core: path.join(vendorDir, 'three.core.js'),
      controls: path.join(vendorDir, 'OrbitControls.js') };
  }
  const assets = [
    [path.join(publicDir, 'city.js'), 'city.js'], [path.join(publicDir, 'style.css'), 'style.css'],
    [vendorDir.module, 'vendor/three.module.js'], [vendorDir.core, 'vendor/three.core.js'],
    [vendorDir.controls, 'vendor/OrbitControls.js']
  ];
  if (vendorDir.license) assets.push([vendorDir.license, 'vendor/LICENSE-three']);
  for (const [source] of assets) await ensureFile(source);
  const html = staticHTML(await readFile(path.join(publicDir, 'city.html'), 'utf8'));
  const staging = path.join(path.dirname(outDir), `.${path.basename(outDir)}-staging-${randomUUID()}`);
  await mkdir(path.join(staging, 'city/buildings'), { recursive: true });
  await mkdir(path.join(staging, 'vendor'), { recursive: true });
  const files = ['index.html', 'city.html', 'city/city.json', marker];
  try {
    await writeFile(path.join(staging, 'index.html'), html);
    await writeFile(path.join(staging, 'city.html'), html);
    await writeFile(path.join(staging, 'city/city.json'), JSON.stringify(city, null, 2) + '\n');
    await writeFile(path.join(staging, marker), 'Chat City static export. Safe to replace with npm run export.\n');
    for (const [source, target] of assets) { await copyFile(source, path.join(staging, target)); files.push(target); }
    for (const source of validatedFiles) {
      const target = `city/buildings/${path.basename(source)}`;
      await copyFile(source, path.join(staging, target)); files.push(target);
    }
    await safeDestination(outDir);
    await rm(outDir, { recursive: true, force: true });
    await rename(staging, outDir);
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { outDir, count: city.plots.length, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await exportCity();
  console.log(`Exported ${result.count} validated buildings to ${result.outDir}`);
}
