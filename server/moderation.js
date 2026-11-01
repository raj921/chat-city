/** Optional: no key means no request; streamer approval remains the default. */
export async function moderateDescription(text, { apiKey = process.env.OPENAI_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) return { allowed: true, skipped: true };
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/moderations', { method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: String(text).slice(0, 200) }),
      signal: AbortSignal.timeout(10_000) });
  } catch { throw new Error('Moderation unavailable'); }
  if (!response.ok) throw new Error(`Moderation unavailable (OpenAI HTTP ${response.status})`);
  const body = await response.json();
  if (typeof body.results?.[0]?.flagged !== 'boolean') throw new Error('Invalid moderation response');
  return { allowed: !body.results[0].flagged, skipped: false };
}
