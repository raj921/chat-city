import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { TwitchClient, SUBSCRIPTIONS, eventCommand } from '../server/twitch.js';

class Socket extends EventEmitter {
  static instances = [];
  constructor(url) { super(); this.url = url; this.closed = false; Socket.instances.push(this); }
  close() { if (!this.closed) { this.closed = true; this.emit('close'); } }
  terminate() { this.close(); }
  message(type, payload, id = type) { this.emit('message', JSON.stringify({ metadata: { message_type: type, message_id: id }, payload })); }
  welcome(id = 'session-one', timeout = 30) { this.message('session_welcome', { session: { id, keepalive_timeout_seconds: timeout } }); }
}
function setup(t, options = {}) {
  Socket.instances = [];
  const requests = [], logs = [];
  const client = new TwitchClient({ eventsubUrl: 'ws://localhost:8080/ws', clientId: 'client', accessToken: 'private-test-token',
    broadcasterId: '100', botUserId: '200', WebSocketImpl: Socket, log: message => logs.push(message),
    fetchImpl: async (url, request) => { requests.push({ url, request, body: JSON.parse(request.body) }); return { ok: true, status: 202 }; }, ...options });
  t.after(() => client.stop());
  return { client, requests, logs };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('welcome subscribes correct versions and conditions while optional failures do not stop chat', async t => {
  const requests = [];
  const { client, logs } = setup(t, { fetchImpl: async (url, request) => {
    const body = JSON.parse(request.body); requests.push({ url, body });
    return { ok: body.type !== 'channel.subscribe', status: body.type === 'channel.subscribe' ? 403 : 202 };
  } });
  await client.start();
  const ready = once(client, 'ready');
  Socket.instances[0].welcome();
  await ready;
  assert.equal(requests.length, 7);
  assert.equal(requests[0].url, 'http://localhost:8080/eventsub/subscriptions');
  const byType = Object.fromEntries(requests.map(item => [item.body.type, item.body]));
  assert.deepEqual(byType['channel.chat.message'].condition, { broadcaster_user_id: '100', user_id: '200' });
  assert.deepEqual(byType['channel.raid'].condition, { to_broadcaster_user_id: '100' });
  assert.equal(byType['channel.hype_train.end'].version, '2');
  assert.ok(requests.every(item => item.body.transport.session_id === 'session-one'));
  assert.ok(logs.some(line => line.includes('optional event disabled')));
  assert.ok(logs.every(line => !line.includes('private-test-token')));
  const notification = once(client, 'event');
  Socket.instances[0].message('notification', { subscription: { type: 'channel.chat.message' }, event: { message: { text: '!city' } } }, 'chat-one');
  assert.equal((await notification)[0].type, 'channel.chat.message');
  assert.equal(SUBSCRIPTIONS.find(item => item.type === 'channel.chat.message').scope, 'user:read:chat');
});

test('server-directed reconnect overlaps sockets and transfers subscriptions without duplicating events', async t => {
  const { client, requests } = setup(t);
  await client.start();
  let ready = once(client, 'ready');
  const old = Socket.instances[0]; old.welcome(); await ready;
  const events = []; client.on('event', event => events.push(event));
  old.message('session_reconnect', { session: { reconnect_url: 'ws://localhost:8080/ws?ticket=abc' } });
  assert.equal(Socket.instances.length, 2);
  const replacement = Socket.instances[1];
  assert.equal(replacement.url, 'ws://localhost:8080/ws?ticket=abc');
  assert.equal(old.closed, false);
  const payload = { subscription: { type: 'channel.raid' }, event: { from_broadcaster_user_login: 'raider' } };
  old.message('notification', payload, 'raid-one');
  ready = once(client, 'ready'); replacement.welcome('session-two'); await ready;
  replacement.message('notification', payload, 'raid-one');
  replacement.message('notification', payload, 'raid-two');
  assert.equal(old.closed, true);
  assert.equal(requests.length, 7);
  assert.equal(events.length, 2);
  assert.equal(client.sessionId, 'session-two');
});

test('connection loss resubscribes; stop cancels retries; invalid JSON and revocations are safe', async t => {
  const { client, requests, logs } = setup(t, { reconnectDelayMs: 5 });
  await client.start();
  let ready = once(client, 'ready');
  const old = Socket.instances[0]; old.welcome(); await ready;
  old.emit('message', '{not-json');
  old.message('revocation', { subscription: { type: 'channel.subscribe', status: 'authorization_revoked' } });
  assert.ok(logs.some(line => line.includes('authorization_revoked')));
  old.close();
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(Socket.instances.length, 2);
  ready = once(client, 'ready'); Socket.instances[1].welcome('fresh-session'); await ready;
  assert.equal(requests.length, 14);
  client.stop(); await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(Socket.instances.length, 2);
});

test('keepalives renew the watchdog; a silent connection is re-established', async t => {
  const { client } = setup(t, { keepaliveGraceMs: 0, reconnectDelayMs: 1 });
  await client.start();
  const ready = once(client, 'ready');
  const old = Socket.instances[0]; old.welcome('short', 0.06); await ready;
  await new Promise(resolve => setTimeout(resolve, 35));
  old.message('session_keepalive', {});
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(old.closed, false);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(old.closed, true);
  assert.equal(Socket.instances.length, 2);
});

test('chat API uses sender ID, caps Unicode messages, detects drops and mock mode never sends real chat', async t => {
  const { client, requests } = setup(t, { chatUrl: 'https://api.twitch.tv/helix/chat/messages',
    fetchImpl: async (url, request) => { requests.push({ url, body: JSON.parse(request.body) }); return { ok: true, json: async () => ({ data: [{ is_sent: true, message_id: 'sent' }] }) }; } });
  assert.equal((await client.sendChat('😀'.repeat(550))).message_id, 'sent');
  assert.equal(requests[0].url, 'https://api.twitch.tv/helix/chat/messages');
  assert.equal(Array.from(requests[0].body.message).length, 500);
  assert.deepEqual(Object.keys(requests[0].body).sort(), ['broadcaster_id', 'message', 'sender_id']);
  assert.equal(requests[0].body.sender_id, '200');
  client.fetch = async () => ({ ok: true, json: async () => ({ data: [{ is_sent: false }] }) });
  await assert.rejects(client.sendChat('hello'), /did not send/);
  const mock = setup(t);
  assert.equal((await mock.client.sendChat('mock reply')).simulated, true);
  assert.equal(mock.requests.length, 0);
});

test('event commands recognize moderator and broadcaster badges, ignore shared-chat sources and reject regular-user demolish', () => {
  const event = { broadcaster_user_id: '100', chatter_user_id: '200', chatter_user_login: 'viewer', message: { text: '!demolish @other' }, badges: [] };
  assert.equal(eventCommand(event), null);
  assert.equal(eventCommand({ ...event, badges: [{ set_id: 'moderator' }] }).type, 'demolish');
  assert.equal(eventCommand({ ...event, chatter_user_id: '100' }).user.isMod, true);
  assert.equal(eventCommand({ ...event, message: { text: '!build a cafe' } }).text, 'a cafe');
  assert.equal(eventCommand({ ...event, source_broadcaster_user_id: '999' }), null);
  assert.equal(eventCommand(null), null);
  assert.equal(eventCommand({ ...event, chatter_user_id: undefined, broadcaster_user_id: undefined }), null);
});

test('unexpected reconnect hosts are ignored and duplicate welcomes do not resubscribe', async t => {
  const { client, requests, logs } = setup(t);
  await client.start();
  const socket = Socket.instances[0];
  const events = []; client.on('event', event => events.push(event));
  socket.message('notification', { subscription: { type: 'channel.raid' }, event: { from_broadcaster_user_login: 'a' } }, 'early');
  assert.equal(events.length, 0);
  const ready = once(client, 'ready'); socket.welcome(); await ready;
  socket.welcome('duplicate');
  socket.message('session_reconnect', { session: { reconnect_url: 'ws://evil.example/ws' } });
  assert.equal(Socket.instances.length, 1);
  assert.equal(requests.length, 7);
  assert.ok(logs.some(line => line.includes('unexpected Twitch reconnect host')));
});

test('missing production credentials disable the client without opening a socket', async t => {
  const { client } = setup(t, { eventsubUrl: 'wss://eventsub.wss.twitch.tv/ws', clientId: '', accessToken: '', broadcasterId: '', botUserId: '' });
  assert.equal(await client.start(), false);
  assert.equal(Socket.instances.length, 0);
  await tick();
});

test('blank .env Twitch values fall back to mock identities on a loopback EventSub URL', async t => {
  const keys = ['TWITCH_CLIENT_ID', 'TWITCH_USER_ACCESS_TOKEN', 'TWITCH_BROADCASTER_ID', 'TWITCH_BOT_USER_ID'];
  const saved = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, i) => saved[i] === undefined ? delete process.env[key] : process.env[key] = saved[i]));
  for (const key of keys) process.env[key] = '';
  const client = new TwitchClient({ eventsubUrl: 'ws://127.0.0.1:8080/ws' });
  assert.deepEqual([client.clientId, client.accessToken, client.broadcasterId, client.botUserId], ['chat-city-local', 'mock', '1', '1']);
});
