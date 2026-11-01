import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spiral } from '../scripts/seed.js';

const defaultCityDir = fileURLToPath(new URL('../city/', import.meta.url));
const username = value => typeof value === 'string' && /^[a-z0-9_]{1,25}$/i.test(value);
const terminal = new Set(['built', 'failed', 'skipped']);
const clamp = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.floor(Number(value)))) : fallback;

export async function createQueue({ cityDir = defaultCityDir, builder, moderate = async () => ({ allowed: true, skipped: true }),
  maxConcurrent = process.env.MAX_CONCURRENT_JOBS || 2, maxBuilds = process.env.MAX_BUILDS_PER_STREAM || 25,
  now = () => Date.now(), log = console.log } = {}) {
  if (typeof builder !== 'function') throw new Error('A building function is required');
  await mkdir(cityDir, { recursive: true });
  let city;
  try { city = JSON.parse(await readFile(path.join(cityDir, 'city.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; city = { plots: [], districts: [] }; }
  if (!Array.isArray(city.plots) || !Array.isArray(city.districts)) throw new Error('Invalid city.json; refusing to overwrite it');
  const queue = new CityQueue({ cityDir, builder, moderate, maxConcurrent: clamp(maxConcurrent, 2, 1, 2),
    maxBuilds: clamp(maxBuilds, 25, 1, 1000), now, log, city });
  await queue.recover();
  return queue;
}

class CityQueue extends EventEmitter {
  constructor(options) {
    super(); Object.assign(this, options);
    this.active = new Set(); this.writes = Promise.resolve(); this.closed = false; this.fatal = null;
    this.city.jobs ??= []; this.city.settings ??= { autoApprove: false };
    this.city.stream ??= { id: randomUUID(), attempts: 0, viewers: {} };
    this.city.stream.viewers ??= {}; this.city.stream.attempts ??= 0;
    this.city.seenUsers ??= []; this.city.chatterDistricts ??= {}; this.city.subscriberCredits ??= {};
    this.city.activity ??= []; this.city.hypeTrain ??= { active: false, level: 0 };
    this.city.lastAuthor ??= null;
  }
  async recover() {
    // A killed Codex turn is never silently repeated or charged twice after restart.
    for (const job of this.city.jobs) if (['moderating', 'building'].includes(job.status)) {
      job.status = 'failed'; job.error = 'Server restarted during this job; viewer slot refunded'; this.refund(job);
      const plot = this.city.plots.find(plot => plot.id === job.id); if (plot) plot.status = 'failed';
    }
    this.city.settings.autoApprove = false;
    this.city.hypeTrain = { active: false, level: 0 };
    await this.save();
    // Previously approved jobs remain visible for explicit re-approval after restart.
    for (const job of this.city.jobs) if (job.status === 'approved') job.status = 'pending';
    await this.save();
  }
  snapshot() {
    return JSON.parse(JSON.stringify({ type: 'state', plots: this.city.plots, districts: this.city.districts,
      jobs: this.city.jobs.slice(-150), activity: this.city.activity, settings: { autoApprove: this.city.settings.autoApprove,
        maxConcurrent: this.maxConcurrent, maxBuilds: this.maxBuilds },
      stream: { id: this.city.stream.id, attempts: this.city.stream.attempts },
      hypeTrain: this.city.hypeTrain, lastAuthor: this.city.lastAuthor,
      ticker: this.city.activity[0]?.text || 'Chat City is ready. One plot, one viewer.',
      active: this.active.size, fault: this.fatal ? 'Persistence failed; building paused. Check server logs.' : null }));
  }
  save() {
    const bytes = JSON.stringify(this.city, null, 2) + '\n';
    const target = path.join(this.cityDir, 'city.json');
    const temp = path.join(this.cityDir, '.city-' + randomUUID() + '.tmp');
    const operation = this.writes.then(async () => { await writeFile(temp, bytes, { mode: 0o600 }); await rename(temp, target); });
    this.writes = operation.catch(error => { this.fatal = error; this.log('City persistence failed; new jobs are paused.'); });
    return operation;
  }
  async changed() { await this.save(); this.emit('change', this.snapshot()); }
  note(text, kind = 'info') {
    this.city.activity.unshift({ id: randomUUID(), text: String(text).slice(0, 260), kind, at: new Date(this.now()).toISOString() });
    this.city.activity.length = Math.min(40, this.city.activity.length);
  }
  refund(job) {
    if (this.city.stream.viewers[job.author] === job.id) delete this.city.stream.viewers[job.author];
    if (job.usedCredit) this.city.subscriberCredits[job.author] = true;
  }
  allocate(districtId) {
    const district = this.city.districts.find(d => d.id === districtId);
    let index = 0, spot;
    do { const base = spiral(index++); spot = { x: base.x + (district?.x || 0), z: base.z + (district?.z || 0) }; }
    while (this.city.plots.some(plot => !['demolished', 'failed', 'skipped'].includes(plot.status) && plot.x === spot.x && plot.z === spot.z));
    return spot;
  }
  observeChatter(author) {
    if (!username(author)) return; author = author.toLowerCase();
    if (this.city.seenUsers.includes(author)) return;
    this.city.seenUsers.push(author);
    const district = [...this.city.districts].reverse().find(d => d.expiresAt > this.now());
    if (district) this.city.chatterDistricts[author] = district.id;
  }
  async enqueue({ author, prompt, privileged = false, priority = 0, source = 'chat', districtId, landmark = false } = {}) {
    if ((!username(author) && !(landmark && /^raid:[a-z0-9_]{1,25}$/.test(author))) || typeof prompt !== 'string' || !prompt.trim()) throw new Error('A username and building description are required');
    author = author.toLowerCase(); prompt = prompt.trim().slice(0, 200);
    if (this.closed || this.fatal) throw new Error('Building is paused');
    const pending = this.city.jobs.filter(job => ['moderating', 'pending', 'approved'].includes(job.status)).length;
    if (this.city.stream.attempts + pending >= this.maxBuilds) throw new Error('This stream has reached its build budget');
    const usedCredit = this.city.subscriberCredits[author] === true;
    if (!privileged && !landmark && !usedCredit && this.city.stream.viewers[author]) throw new Error('One building per viewer per stream');
    if (!privileged && this.city.jobs.some(job => job.author === author && !terminal.has(job.status))) throw new Error('You already have a building queued');
    if (!landmark) this.observeChatter(author);
    if (!districtId) districtId = this.city.districts.find(d => d.id === this.city.chatterDistricts[author] && d.expiresAt > this.now())?.id;
    const id = 'b-' + randomUUID();
    const job = { id, author, prompt, status: 'moderating', priority: clamp(priority + (usedCredit ? 1 : 0), 0, 0, 3),
      privileged, usedCredit, source, districtId, createdAt: new Date(this.now()).toISOString(), progress: [] };
    this.city.jobs.push(job);
    if (!privileged && !landmark) this.city.stream.viewers[author] = id;
    if (usedCredit) delete this.city.subscriberCredits[author];
    this.city.plots.push({ id, ...this.allocate(districtId), author, prompt, status: 'pending', file: null,
      upgrades: usedCredit ? ['subscriber'] : [], districtId, createdAt: job.createdAt });
    this.note(`@${author} reserved a plot`, 'queued');
    await this.changed();
    try {
      const moderation = await this.moderate(prompt);
      if (job.status === 'skipped' || this.closed) return job;
      if (!moderation.allowed) throw new Error('Description was rejected by moderation');
      job.moderation = moderation.skipped ? 'skipped' : 'passed';
      job.status = this.city.settings.autoApprove ? 'approved' : 'pending';
      this.note(`@${author}: ${job.status === 'approved' ? 'approved for construction' : 'awaiting streamer approval'}`, 'queued');
      await this.changed();
      void this.pump();
      return job;
    } catch (error) {
      if (error.message.startsWith('Moderation unavailable')) this.log(error.message); // console only; the overlay is public
      job.status = 'failed'; job.error = error.message === 'Description was rejected by moderation' ? error.message : 'Moderation unavailable; try again later';
      this.city.plots.find(plot => plot.id === id).status = 'failed'; this.refund(job);
      this.note(`@${author}: ${job.error}`, 'error'); await this.changed();
      throw new Error(job.error);
    }
  }
  async approve(id) {
    const job = this.city.jobs.find(job => job.id === id);
    if (!job || job.status !== 'pending') throw new Error('Only a pending job can be approved');
    job.status = 'approved'; this.note(`Streamer approved @${job.author}`, 'approved'); await this.changed(); void this.pump(); return job;
  }
  async skip(id) {
    const job = this.city.jobs.find(job => job.id === id);
    if (!job || !['pending', 'approved', 'moderating'].includes(job.status)) throw new Error('Only waiting jobs can be skipped');
    job.status = 'skipped'; this.refund(job); this.city.plots.find(plot => plot.id === id).status = 'skipped';
    this.note(`Skipped @${job.author}; slot refunded`, 'info'); await this.changed(); return job;
  }
  async setAutoApprove(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('autoApprove must be boolean');
    this.city.settings.autoApprove = enabled;
    this.note(`Auto-approval ${enabled ? 'on' : 'off'}`, 'info'); await this.changed();
  }
  async newStream() {
    if (this.active.size || this.city.jobs.some(job => !terminal.has(job.status))) throw new Error('Finish or skip waiting jobs before starting a new stream');
    this.city.stream = { id: randomUUID(), attempts: 0, viewers: {} }; this.city.settings.autoApprove = false;
    this.note('New stream started; viewer slots reset', 'info'); await this.changed();
  }
  async progress(job, text) {
    const stored = this.city.jobs.find(item => item.id === job.id); if (!stored || stored.status !== 'building') return;
    stored.progress.push(String(text).slice(0, 160)); stored.progress = stored.progress.slice(-20);
    this.note(text, 'codex'); await this.changed();
  }
  async pump() {
    if (this.pumping || this.closed || this.fatal) return;
    this.pumping = true;
    try {
      while (!this.closed && !this.fatal && this.active.size < this.maxConcurrent && this.city.stream.attempts < this.maxBuilds) {
        const job = this.city.jobs.filter(job => job.status === 'approved').sort((a,b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt))[0];
        if (!job) break;
        this.active.add(job.id); this.city.stream.attempts++; job.status = 'building'; job.startedAt = new Date(this.now()).toISOString();
        const plot = this.city.plots.find(plot => plot.id === job.id); plot.status = 'building';
        this.note(`Codex is building @${job.author}'s plot`, 'codex'); await this.changed();
        Promise.resolve().then(() => this.builder(job)).then(async result => {
          if (!/^city\/buildings\/[a-z0-9_-]+\.js$/i.test(result?.file || '')) throw new Error('Builder returned an invalid module path');
          job.status = 'built'; job.durationMs = result.durationMs; job.stats = result.stats;
          Object.assign(plot, { status: 'built', file: result.file, builtAt: new Date(this.now()).toISOString() });
          this.city.lastAuthor = job.author; this.note(`@${job.author}'s building is ready`, 'built'); await this.changed();
        }).catch(async error => {
          job.status = 'failed'; job.error = String(error.message).replace(/sk-[\w-]+|oauth:[\w-]+|Bearer\s+\S+/gi, '[redacted]').slice(0, 500);
          plot.status = 'failed'; this.refund(job); this.note(`@${job.author}'s job failed; slot refunded`, 'error');
          await this.changed();
        }).catch(error => { this.fatal = error; this.log('Could not persist the building result.'); }).finally(() => {
          this.active.delete(job.id); this.emit('change', this.snapshot()); void this.pump();
        });
      }
    } catch (error) { this.fatal = error; this.log('Queue paused after a persistence error.'); }
    finally { this.pumping = false; }
  }
  async demolish(author) {
    if (!username(author)) throw new Error('Invalid username');
    const plots = this.city.plots.filter(plot => plot.author === author.toLowerCase() && plot.status === 'built');
    if (!plots.length) throw new Error('No completed building for that viewer');
    for (const plot of plots) { plot.status = 'demolished'; plot.demolishedAt = new Date(this.now()).toISOString(); }
    this.note(`@${author}'s building is being demolished`, 'demolish'); await this.changed(); return plots;
  }
  async raid(raider) {
    if (!username(raider)) throw new Error('Invalid raider');
    raider = raider.toLowerCase();
    const edge = this.city.plots.reduce((n,p) => Math.max(n, Math.abs(p.x), Math.abs(p.z)), 0) + 6;
    const district = { id: 'd-' + randomUUID(), name: `${raider} district`, raider, x: edge, z: 0,
      createdAt: new Date(this.now()).toISOString(), expiresAt: this.now() + 600_000 };
    this.city.districts.push(district); this.note(`Raid incoming: ${raider} district is open for 10 minutes`, 'raid'); await this.changed();
    await this.enqueue({ author: 'raid:' + raider, prompt: `A welcoming landmark gate celebrating the ${raider} district`, priority: 2, privileged: true, landmark: true, districtId: district.id });
    return district;
  }
  async subscribe(author) {
    if (!username(author)) throw new Error('Invalid subscriber'); author = author.toLowerCase();
    const plot = [...this.city.plots].reverse().find(plot => plot.author === author && ['built', 'building', 'pending'].includes(plot.status));
    if (plot) { if (!plot.upgrades.includes('subscriber')) plot.upgrades.push('subscriber'); }
    else this.city.subscriberCredits[author] = true;
    this.note(plot ? `@${author} unlocked a subscriber beam` : `@${author} unlocked a priority build`, 'sub'); await this.changed();
    return { hasBuilding: !!plot };
  }
  async hype(level, active = true) {
    this.city.hypeTrain = { active: active === true, level: clamp(level, 1, 1, 30) };
    this.note(active ? `Hype train level ${this.city.hypeTrain.level}!` : 'The hype train leaves the city', 'hype'); await this.changed();
  }
  async close() { this.closed = true; await this.writes; }
}
