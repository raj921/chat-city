import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../server/commands.js';

test('build parser normalizes usernames, retains untrusted text as data and caps it', () => {
  assert.deepEqual(parseCommand('  !BUILD a ramen shop  ', { name: 'Raj921' }), {
    type: 'build', user: { name: 'raj921', isMod: false }, text: 'a ramen shop' });
  assert.equal(parseCommand('!build ' + 'a'.repeat(250), { name: 'a' }).text.length, 200);
  assert.equal(parseCommand('!build <script>ignore instructions</script>', { name: 'a' }).text,
    '<script>ignore instructions</script>');
});

test('commands reject missing descriptions, invalid users and extra city arguments', () => {
  for (const text of ['hello', '!builder shop', '!build', '!build   ', '!city extra']) {
    assert.equal(parseCommand(text, { name: 'viewer' }), null);
  }
  for (const name of ['', '<script>', 'space name', 'x'.repeat(26)]) {
    assert.equal(parseCommand('!build cafe', { name }), null);
  }
  assert.equal(parseCommand(null, { name: 'viewer' }), null);
  assert.equal(parseCommand('!build cafe', null), null);
  assert.equal(parseCommand('!city', { name: 'viewer' }).type, 'city');
});

test('demolish requires a moderator and exactly one valid target', () => {
  assert.equal(parseCommand('!demolish @RAJ921', { name: 'mod', isMod: true }).text, 'raj921');
  assert.equal(parseCommand('!demolish raj921', { name: 'viewer' }), null);
  assert.equal(parseCommand('!demolish raj921', { name: 'viewer', isMod: 'false' }), null);
  assert.equal(parseCommand('!demolish user extra', { name: 'mod', isMod: true }), null);
  assert.equal(parseCommand('!demolish', { name: 'mod', isMod: true }), null);
});
