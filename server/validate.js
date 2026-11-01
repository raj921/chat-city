import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const childFile = fileURLToPath(new URL('./validate-child.js', import.meta.url));
const verifiedNodes = new Map();
const childEnvironment = () => ({ PATH: process.env.PATH || '', ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot || '' } : {}) });
const banned = /\b(?:import|require|fetch|XMLHttpRequest|WebSocket|eval|window|document|globalThis|global|process|localStorage|sessionStorage|setTimeout|setInterval|setImmediate|postMessage|queueMicrotask|Date|Promise|async|await|constructor|__proto__|prototype|Reflect|Proxy|WebAssembly|SharedArrayBuffer|Atomics|Buffer|console|crypto)\b|\bFunction\s*\(|\bMath\s*\.\s*random\b|\\u[\da-f{]|\bTHREE\s*\.\s*\w*(?:Texture|Loader)\b/i;

export function checkSource(source) {
  if (Buffer.byteLength(source) >= 30_000) return 'Building must be under 30 KB';
  const match = source.match(banned);
  if (match) return `Banned token: ${match[0]}`;
  if (!/export\s+default\s+function\s+build\s*\(\s*THREE\s*,\s*rng\s*\)/.test(source)) {
    return 'Use export default function build(THREE, rng)';
  }
  return null;
}

async function validatorNode(nodePath) {
  if (typeof nodePath !== 'string' || !path.isAbsolute(nodePath)) throw new Error('Validator Node executable must be an absolute trusted path');
  let executable;
  try { executable = await realpath(nodePath); }
  catch { throw new Error(`Validator Node executable was not found: ${nodePath}`); }
  if (verifiedNodes.has(executable)) return verifiedNodes.get(executable);
  const probe = await new Promise((resolve, reject) => {
    const code = `console.log(JSON.stringify({version:process.versions.node,network:process.allowedNodeEnvironmentFlags.has('--allow-net'),permission:process.allowedNodeEnvironmentFlags.has('--permission')}))`;
    const child = spawn(executable, ['--eval', code], { env: childEnvironment(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error('Validator Node capability probe timed out')); }, 3000);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 2048) { child.kill('SIGKILL'); finish(new Error('Validator Node capability probe returned too much output')); }
    });
    child.stderr.resume();
    child.on('error', error => finish(new Error(`Validator Node could not start: ${error.message}`)));
    child.on('close', status => {
      if (status !== 0) return finish(new Error('Validator Node capability probe failed'));
      try { finish(null, JSON.parse(stdout)); }
      catch { finish(new Error('Validator Node capability probe returned invalid output')); }
    });
  });
  const major = Number(String(probe.version).split('.')[0]);
  if (!probe.network || !probe.permission || !Number.isInteger(major) || major < 25) {
    throw new Error('Node 25+ is required: the selected validator executable cannot deny network access');
  }
  verifiedNodes.set(executable, executable);
  return executable;
}

/** Denylist + Node permissions is a shortcut, not a complete JavaScript sandbox. */
export async function validateBuilding(filename, { cityDir = path.join(root, 'city'), timeoutMs = 3000,
  nodePath = process.env.VALIDATOR_NODE || process.execPath } = {}) {
  let frozenDir;
  try {
    const allowedDir = await realpath(cityDir);
    const file = await realpath(filename);
    const relative = path.relative(allowedDir, file);
    if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return { ok: false, error: 'Building must be inside the supplied city directory' };
    const info = await stat(file);
    if (!info.isFile() || info.size >= 30_000) return { ok: false, error: 'Building must be a regular file under 30 KB' };
    const source = await readFile(file, 'utf8');
    const error = checkSource(source);
    if (error) return { ok: false, error };
    const executable = await validatorNode(nodePath);
    let threeRoot;
    try { threeRoot = await realpath(path.dirname(path.dirname(require.resolve('three')))); }
    catch { return { ok: false, error: 'Three.js is not installed; run npm install' }; }
    // Freeze the inspected bytes before executing; a job cannot swap its source during validation.
    frozenDir = await realpath(await mkdtemp(path.join(tmpdir(), 'chat-city-validate-')));
    const frozenFile = path.join(frozenDir, 'building.mjs');
    await writeFile(frozenFile, source, { mode: 0o600 });
    const args = ['--permission', '--max-old-space-size=128', '--disable-proto=throw', '--no-warnings',
      `--allow-fs-read=${path.dirname(childFile)}`, `--allow-fs-read=${path.join(root, 'package.json')}`,
      `--allow-fs-read=${threeRoot}`, `--allow-fs-read=${frozenDir}`, childFile, frozenFile];
    const output = await new Promise(resolve => {
      const child = spawn(executable, args, { cwd: frozenDir,
        env: childEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let stdout = '', stderr = '', settled = false;
      const finish = result => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ ok: false, error: `Validation timed out after ${timeoutMs} ms` }); }, Math.max(1, Math.min(timeoutMs, 10_000)));
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (stdout.length > 32_768) { child.kill('SIGKILL'); finish({ ok: false, error: 'Validation output exceeded limit' }); }
      });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
      child.on('error', error => finish({ ok: false, error: `Validator could not start: ${error.message}` }));
      child.on('close', (code, signal) => {
        if (settled) return;
        if (code !== 0) return finish({ ok: false, error: `Validator exited ${signal || code}: ${stderr.slice(-600)}` });
        try { finish(JSON.parse(stdout)); }
        catch { finish({ ok: false, error: 'Validator returned invalid output' }); }
      });
    });
    if (!output || output.ok !== true || !output.stats) return { ok: false, error: String(output?.error || 'Invalid building').slice(0, 1000) };
    output.stats.sourceHash = createHash('sha256').update(source).digest('hex');
    return output;
  } catch (error) {
    return { ok: false, error: error.code === 'ENOENT' ? 'building.js is missing' : `Validation failed: ${String(error.message).slice(0, 600)}` };
  } finally {
    if (frozenDir) await rm(frozenDir, { recursive: true, force: true });
  }
}
