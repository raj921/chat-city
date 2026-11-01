export function parseCommand(message, user) {
  if (typeof message !== 'string' || typeof user?.name !== 'string' ||
      !/^[a-z0-9_]{1,25}$/i.test(user.name)) return null;
  const match = message.trim().match(/^!(build|demolish|city)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const text = (match[2] || '').trim();
  if (type === 'build' && !text) return null;
  if (type === 'city' && text) return null;
  if (type === 'demolish' && (user.isMod !== true || !/^@?[a-z0-9_]{1,25}$/i.test(text))) return null;
  return { type, user: { name: user.name.toLowerCase(), isMod: user.isMod === true },
    text: type === 'demolish' ? text.replace(/^@/, '').toLowerCase() : text.slice(0, 200) };
}
