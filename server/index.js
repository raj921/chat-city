import 'dotenv/config';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const { WebSocket, WebSocketServer } = createRequire(import.meta.url)('ws');
import { parseCommand } from './commands.js';
import { createQueue } from './queue.js';
import { createBuilder } from './builder.js';
import { moderateDescription } from './moderation.js';
import { TwitchClient, eventCommand } from './twitch.js';
import { seedCity } from '../scripts/seed.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const pages = { '/': 'city.html', '/dev': 'dev.html', '/dev/': 'dev.html', '/dev.html': 'dev.html',
  '/dashboard': 'dashboard.html', '/dashboard.html': 'dashboard.html', '/dashboard.js': 'dashboard.js',
  '/overlay.html': 'overlay.html', '/city.html': 'city.html', '/city.js': 'city.js', '/dev.js': 'dev.js', '/style.css': 'style.css' };
const vendor = { '/vendor/three.module.js': 'three/build/three.module.js', '/vendor/three.core.js': 'three/build/three.core.js',
  '/vendor/OrbitControls.js': 'three/examples/jsm/controls/OrbitControls.js' };
const localHost = value => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(value || '');

export async function createApp({ cityDir = path.join(root, 'city'), builder, moderate = moderateDescription,
  startTwitch = false, seed = true, twitchOptions = {}, log = console.log } = {}) {
  if (seed) await seedCity({ cityDir });
  let queue;
  const runtime = { twitch: 'disabled', moderation: !!process.env.OPENAI_API_KEY, engine: 'Codex SDK' };
  const realBuilder = builder || createBuilder({ cityDir, log, onProgress(job, text) {
    queue.progress(job, text).catch(() => log('Progress could not be persisted.'));
  } });
  queue = await createQueue({ cityDir, builder: realBuilder, moderate, log });
  const twitch = new TwitchClient({ ...twitchOptions, log });
  const snapshot = () => JSON.stringify({ ...queue.snapshot(), runtime });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const broadcast = () => { const message = snapshot(); for (const client of wss.clients) if (client.readyState === WebSocket.OPEN) client.send(message); };
  queue.on('change', broadcast);
  twitch.on('ready', () => { runtime.twitch = 'connected'; broadcast(); });
  twitch.on('disconnected', () => { runtime.twitch = 'reconnecting'; broadcast(); });
  twitch.on('warning', () => { broadcast(); });
  const publicLink = () => process.env.PUBLIC_CITY_URL || 'http://localhost:3000/city.html';
  async function commandAction(command, source = 'dev', extra = {}) {
    if (!command) throw new Error('Use !build <description>, !city, or moderator !demolish <user>');
    if (command.type === 'city') return { message: publicLink() };
    if (command.type === 'demolish') {
      await queue.demolish(command.text); return { message: `@${command.text}'s building is coming down` };
    }
    const job = await queue.enqueue({ author: command.user.name, prompt: command.text, privileged: command.user.isMod, source, ...extra });
    const ahead = queue.city.jobs.filter(item => ['pending','approved','building'].includes(item.status) && item.id !== job.id).length;
    return { message: `@${job.author} plot reserved (${ahead} ahead). ${job.status === 'pending' ? 'Awaiting streamer approval.' : 'Codex is on it.'}`, job };
  }
  async function onEvent({ type, event }) {
    if (type === 'channel.chat.message') {
      const command = eventCommand(event);
      if (!command || command.type !== 'build') { queue.observeChatter(event.chatter_user_login); await queue.changed(); }
      if (!command) return;
      try { const response = await commandAction(command, 'twitch'); await twitch.sendChat(response.message); }
      catch (error) { await twitch.sendChat(`@${command.user.name} ${error.message.slice(0, 180)}`).catch(() => {}); }
    } else if (type === 'channel.raid') {
      await queue.raid(event.from_broadcaster_user_login || event.from_broadcaster_user_name);
    } else if (type === 'channel.subscribe') {
      const author = event.user_login;
      const result = await queue.subscribe(author);
      if (!result.hasBuilding) await queue.enqueue({ author, prompt: 'A golden subscriber clubhouse with a glowing rooftop beacon', priority: 1, source: 'subscriber' });
    } else if (type === 'channel.channel_points_custom_reward_redemption.add' && event.reward?.title === 'Build in Chat City') {
      await queue.enqueue({ author: event.user_login, prompt: event.user_input || 'A colorful community clubhouse', priority: 2, source: 'channel-points' });
    } else if (type.startsWith('channel.hype_train.')) {
      await queue.hype(event.level || 1, !type.endsWith('.end'));
    }
  }
  twitch.on('event', value => { onEvent(value).catch(error => { queue.note(error.message.slice(0, 200), 'error'); queue.changed().catch(() => {}); }); });
  if (startTwitch) { runtime.twitch = 'connecting'; if (!(await twitch.start())) runtime.twitch = 'disabled'; }

  function json(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  async function bodyJSON(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Use application/json'), { status: 415 });
    req.setEncoding('utf8'); let body = '';
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      body += chunk;
      if (Buffer.byteLength(body) > 4096) { req.resume(); throw Object.assign(new Error('Message too large'), { status: 413 }); }
    }
    let data;
    try { data = JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
    if (!data || Array.isArray(data) || typeof data !== 'object') throw Object.assign(new Error('Expected an object'), { status: 400 });
    return data;
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (!localHost(req.headers.host)) return json(res, 403, { error: 'Local host required' });
      if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) return json(res, 403, { error: 'Same-origin requests only' });
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, JSON.parse(snapshot()));
      if (req.method === 'POST' && pathname.startsWith('/api/')) {
        const data = await bodyJSON(req);
        try {
          let result = { ok: true };
          if (pathname === '/api/dev/chat') result = await commandAction(parseCommand(data.message, { name: data.username, isMod: data.isMod === true }));
          else if (pathname === '/api/jobs/approve') await queue.approve(data.id);
          else if (pathname === '/api/jobs/skip') await queue.skip(data.id);
          else if (pathname === '/api/demolish') await queue.demolish(data.author);
          else if (pathname === '/api/settings') await queue.setAutoApprove(data.autoApprove);
          else if (pathname === '/api/new-stream') await queue.newStream();
          else if (pathname === '/api/dev/event') {
            if (data.type === 'raid') await queue.raid(data.username || 'visiting_chat');
            else if (data.type === 'sub') await onEvent({ type: 'channel.subscribe', event: { user_login: data.username || 'new_subscriber' } });
            else if (data.type === 'hype') await queue.hype(data.level || 1, data.active !== false);
            else throw new Error('Unknown simulated event');
            queue.note('Simulated Twitch event: ' + data.type, 'simulated'); await queue.changed();
          } else return json(res, 404, { error: 'Not found' });
          return json(res, 200, result);
        } catch (error) { return json(res, 400, { error: error.message }); }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
      let filename;
      if (pages[pathname]) filename = path.join(root, 'public', pages[pathname]);
      else if (vendor[pathname]) filename = path.join(root, 'node_modules', vendor[pathname]);
      else if (/^\/city\/buildings\/[a-z0-9_-]+\.js$/i.test(pathname) && queue.city.plots.some(plot => ['built','demolished'].includes(plot.status) && '/' + plot.file === pathname)) {
        filename = path.join(cityDir, 'buildings', path.basename(pathname));
      }
      if (!filename) return json(res, 404, { error: 'Not found' });
      const content = await readFile(filename);
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const status = error.status || (error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500);
      json(res, status, { error: status === 500 ? 'Server error; see local logs' : error.code === 'ENOENT' ? 'Not found' : error.message });
      if (status === 500) log('Server request failed.');
    }
  });
  server.requestTimeout = 20_000;
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws' || !localHost(req.headers.host) || (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host)) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', client => { client.alive = true; client.on('pong', () => { client.alive = true; }); client.on('error', () => {}); client.send(snapshot()); });
  const heartbeat = setInterval(() => { for (const client of wss.clients) { if (!client.alive) client.terminate(); else { client.alive = false; client.ping(); } } }, 30_000);
  heartbeat.unref();
  return { server, wss, queue, twitch, async close() {
    clearInterval(heartbeat); twitch.stop(); await queue.close();
    for (const client of wss.clients) client.terminate();
    await new Promise(resolve => wss.close(resolve));
    server.closeIdleConnections();
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

async function main() {
  const host = process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('Controls are local; use static export for the public city');
  const port = Number(process.env.PORT || 3000);
  const app = await createApp({ startTwitch: true });
  app.server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  app.server.listen(port, host, () => console.log(`Chat City: http://localhost:${port}/city.html · dashboard: /dashboard · playground: /dev`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { app.close().catch(console.error); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
