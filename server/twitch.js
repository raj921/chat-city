import { EventEmitter } from 'node:events';
import { parseCommand } from './commands.js';

// Verified against Twitch's official EventSub subscription reference, 2026-11-01.
export const SUBSCRIPTIONS = Object.freeze([
  { type: 'channel.chat.message', version: '1', scope: 'user:read:chat', optional: false },
  { type: 'channel.raid', version: '1', scope: null, optional: false },
  { type: 'channel.channel_points_custom_reward_redemption.add', version: '1', scope: 'channel:read:redemptions', optional: true },
  { type: 'channel.subscribe', version: '1', scope: 'channel:read:subscriptions', optional: true },
  ...['begin', 'progress', 'end'].map(event => ({ type: `channel.hype_train.${event}`, version: '2', scope: 'channel:read:hype_train', optional: true })),
].map(Object.freeze));

export function eventCommand(event) {
  if (!event || (event.source_broadcaster_user_id && event.source_broadcaster_user_id !== event.broadcaster_user_id)) return null;
  const isBroadcaster = typeof event.chatter_user_id === 'string' && event.chatter_user_id.length > 0 &&
    event.chatter_user_id === event.broadcaster_user_id;
  const isMod = isBroadcaster || (Array.isArray(event.badges) && event.badges.some(badge => ['moderator', 'broadcaster'].includes(badge.set_id)));
  return parseCommand(event.message?.text, { name: event.chatter_user_login, id: event.chatter_user_id, isMod });
}

const isLoopback = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const statusWord = value => typeof value === 'string' && /^[a-z_]{1,50}$/.test(value) ? value : 'unknown';

export class TwitchClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.eventsubUrl = options.eventsubUrl || process.env.TWITCH_EVENTSUB_URL || 'wss://eventsub.wss.twitch.tv/ws';
    const websocketUrl = new URL(this.eventsubUrl);
    if (!['ws:', 'wss:'].includes(websocketUrl.protocol)) throw new Error('TWITCH_EVENTSUB_URL must use ws: or wss:');
    this.mock = isLoopback(websocketUrl);
    const mockSubscriptions = new URL('/eventsub/subscriptions', websocketUrl);
    mockSubscriptions.protocol = websocketUrl.protocol === 'wss:' ? 'https:' : 'http:';
    this.subscriptionsUrl = options.subscriptionsUrl || process.env.TWITCH_SUBSCRIPTIONS_URL ||
      (this.mock ? mockSubscriptions.href : 'https://api.twitch.tv/helix/eventsub/subscriptions');
    this.chatUrl = options.chatUrl || process.env.TWITCH_CHAT_URL || 'https://api.twitch.tv/helix/chat/messages';
    // Twitch CLI has no chat-send API. Never let mock events send real messages.
    this.simulateChat = this.mock && !options.chatUrl && !process.env.TWITCH_CHAT_URL;
    // .env.example leaves these blank, so empty strings must fall through to the mock defaults.
    this.clientId = options.clientId ?? (process.env.TWITCH_CLIENT_ID || (this.mock ? 'chat-city-local' : ''));
    this.accessToken = options.accessToken ?? (process.env.TWITCH_USER_ACCESS_TOKEN || (this.mock ? 'mock' : ''));
    this.broadcasterId = String(options.broadcasterId ?? (process.env.TWITCH_BROADCASTER_ID || (this.mock ? '1' : '')));
    this.botUserId = String(options.botUserId ?? (process.env.TWITCH_BOT_USER_ID || this.broadcasterId));
    this.fetch = options.fetchImpl || globalThis.fetch;
    this.WebSocket = options.WebSocketImpl;
    this.log = options.log || console.log;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1000;
    this.welcomeTimeoutMs = options.welcomeTimeoutMs ?? 15_000;
    this.keepaliveGraceMs = options.keepaliveGraceMs ?? 1000;
    this.running = false;
    this.sockets = new Map();
    this.seen = new Set();
    this.socket = null;
    this.pendingSocket = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.sessionId = null;
  }

  warn(message) {
    this.log(message);
    this.emit('warning', message);
  }

  async start() {
    if (this.running) return true;
    if (!this.mock && (!this.clientId || !this.accessToken || !this.broadcasterId || !this.botUserId)) {
      this.warn('Twitch disabled: configure client ID, user access token, broadcaster ID and bot user ID.');
      return false;
    }
    if (!this.WebSocket) this.WebSocket = (await import('ws')).WebSocket;
    this.running = true;
    this.connect(this.eventsubUrl);
    return true;
  }

  stop() {
    this.running = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const [socket, record] of this.sockets) {
      clearTimeout(record.timer);
      try { socket.terminate ? socket.terminate() : socket.close(); } catch { /* Already closed. */ }
    }
    this.sockets.clear();
    this.socket = null;
    this.pendingSocket = null;
    this.sessionId = null;
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer || this.pendingSocket) return;
    const delay = Math.min(30_000, this.reconnectDelayMs * 2 ** Math.min(this.reconnectAttempts++, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.running) this.connect(this.eventsubUrl);
    }, delay);
    this.reconnectTimer.unref?.();
  }

  connect(url, previous = null) {
    if (!this.running) return;
    let socket;
    try { socket = new this.WebSocket(url, { maxPayload: 256 * 1024 }); }
    catch {
      this.warn('Twitch socket could not connect; retrying.');
      this.scheduleReconnect();
      return;
    }
    const record = { previous, welcomed: false, timeoutMs: this.welcomeTimeoutMs, timer: null };
    this.sockets.set(socket, record);
    if (previous) this.pendingSocket = socket;
    else this.socket = socket;
    this.armWatchdog(socket, record);
    socket.on('message', data => {
      this.receive(socket, data).catch(() => this.warn('Twitch message handling failed.'));
    });
    socket.on('error', () => {
      this.warn('Twitch socket error; reconnecting if the connection closes.');
      // ws emits close after connection errors; let close own reconnect scheduling.
    });
    socket.on('close', () => {
      clearTimeout(record.timer);
      this.sockets.delete(socket);
      if (this.pendingSocket === socket) this.pendingSocket = null;
      if (this.socket === socket) {
        this.socket = null;
        this.sessionId = null;
      }
      // Closing the retired socket after a handover must not open a third one.
      if (this.running && !this.socket && !this.pendingSocket) {
        this.emit('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  armWatchdog(socket, record) {
    clearTimeout(record.timer);
    record.timer = setTimeout(() => {
      this.warn(record.welcomed ? 'Twitch keepalive expired; reconnecting.' : 'Twitch welcome timed out; reconnecting.');
      if (this.pendingSocket && socket === this.socket) {
        try { socket.terminate ? socket.terminate() : socket.close(); } catch { /* Already closed. */ }
        return;
      }
      try { socket.terminate ? socket.terminate() : socket.close(); } catch { /* Already closed. */ }
    }, record.timeoutMs);
    record.timer.unref?.();
  }

  async receive(socket, data) {
    const record = this.sockets.get(socket);
    if (!record || !this.running) return;
    let message;
    try { message = JSON.parse(String(data)); }
    catch { this.warn('Ignored invalid Twitch JSON.'); return; }
    const kind = message.metadata?.message_type;
    const payload = message.payload;
    if (!payload || typeof payload !== 'object') return;
    if (kind === 'session_welcome') {
      if (record.welcomed) return;
      const session = payload.session;
      if (typeof session?.id !== 'string' || !session.id) return;
      record.welcomed = true;
      const seconds = Number(session.keepalive_timeout_seconds);
      record.timeoutMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 + this.keepaliveGraceMs : 31_000;
      this.armWatchdog(socket, record);
      this.socket = socket;
      this.sessionId = session.id;
      this.reconnectAttempts = 0;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      if (record.previous) {
        this.pendingSocket = null;
        // Twitch transfers subscriptions on its reconnect URL: never resubscribe.
        const oldRecord = this.sockets.get(record.previous);
        if (oldRecord) clearTimeout(oldRecord.timer);
        try { record.previous.close(); } catch { /* Retired connection already closed. */ }
      } else {
        await this.subscribe(session.id);
      }
      if (this.running && this.socket === socket) this.emit('ready', { sessionId: session.id, reconnected: !!record.previous });
      return;
    }
    if (kind === 'session_keepalive' || kind === 'notification') this.armWatchdog(socket, record);
    if (kind === 'session_keepalive') return;
    if (kind === 'session_reconnect') {
      if (this.pendingSocket || socket !== this.socket) return;
      const url = payload.session?.reconnect_url;
      try {
        const target = new URL(url);
        // Production handovers stay on Twitch over TLS. The CLI may use loopback.
        if (this.mock ? !isLoopback(target) || !['ws:', 'wss:'].includes(target.protocol) : target.protocol !== 'wss:' || target.hostname !== 'eventsub.wss.twitch.tv') {
          this.warn('Ignored an unexpected Twitch reconnect host.');
          return;
        }
      } catch { this.warn('Ignored an invalid Twitch reconnect URL.'); return; }
      this.connect(url, socket);
      return;
    }
    if (kind === 'revocation') {
      const type = SUBSCRIPTIONS.find(subscription => subscription.type === payload.subscription?.type)?.type || 'unknown';
      const status = statusWord(payload.subscription?.status);
      this.warn(`Twitch subscription revoked: ${type} (${status}).`);
      this.emit('revocation', { type, status });
      return;
    }
    if (kind !== 'notification' || !record.welcomed) return;
    const id = message.metadata?.message_id;
    const type = payload.subscription?.type || message.metadata?.subscription_type;
    if (typeof id !== 'string' || !id || !SUBSCRIPTIONS.some(subscription => subscription.type === type) || !payload.event) return;
    if (this.seen.has(id)) return;
    this.seen.add(id);
    // shortcut: bounded FIFO dedup across reconnects, add durable event storage if replay is added.
    if (this.seen.size > 5000) this.seen.delete(this.seen.values().next().value);
    this.emit('event', { type, event: payload.event, id });
  }

  async subscribe(sessionId) {
    await Promise.all(SUBSCRIPTIONS.map(async subscription => {
      const condition = subscription.type === 'channel.raid'
        ? { to_broadcaster_user_id: this.broadcasterId }
        : { broadcaster_user_id: this.broadcasterId };
      if (subscription.type === 'channel.chat.message') condition.user_id = this.botUserId;
      try {
        const response = await this.fetch(this.subscriptionsUrl, { method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: subscription.type, version: subscription.version, condition,
            transport: { method: 'websocket', session_id: sessionId } }), signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
          this.warn(`Twitch ${subscription.type} subscription failed (HTTP ${response.status})${subscription.optional ? '; optional event disabled' : '; check token scopes and account IDs'}.`);
          return;
        }
        this.log(`Twitch subscribed: ${subscription.type} v${subscription.version}.`);
      } catch {
        this.warn(`Twitch ${subscription.type} subscription request failed; other events remain available.`);
      }
    }));
  }

  async sendChat(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('Chat message must not be empty');
    const message = Array.from(text.trim()).slice(0, 500).join('');
    if (this.simulateChat) {
      this.emit('reply', { message, simulated: true });
      return { is_sent: false, simulated: true };
    }
    if (!this.clientId || !this.accessToken || !this.broadcasterId || !this.botUserId) throw new Error('Twitch chat credentials are not configured');
    let response;
    try {
      response = await this.fetch(this.chatUrl, { method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcaster_id: this.broadcasterId, sender_id: this.botUserId, message }),
        signal: AbortSignal.timeout(8000) });
    } catch { throw new Error('Twitch chat request failed'); }
    if (!response.ok) throw new Error(`Twitch chat failed (HTTP ${response.status})`);
    let data;
    try { data = await response.json(); } catch { throw new Error('Twitch chat returned invalid JSON'); }
    if (data.data?.[0]?.is_sent !== true) throw new Error('Twitch did not send the chat message');
    return data.data[0];
  }
}
