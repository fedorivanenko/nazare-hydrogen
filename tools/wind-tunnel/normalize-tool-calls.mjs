import {randomUUID} from 'node:crypto';

const originalFetch = globalThis.fetch.bind(globalThis);
const agentToolNames = new Set(['read_file', 'apply_patch', 'exec']);

function normalizeToolName(recipient) {
  if (!recipient) return null;
  const name = recipient.trim().replace(/^functions\./, '');
  return agentToolNames.has(name) ? name : null;
}

function parseHarmonyToolCalls(content) {
  if (typeof content !== 'string' || !content.includes('to=')) return [];

  const calls = [];
  const harmony = /<\|channel\|>(?:analysis|commentary)\s+to=([^\s<]+)(?:\s*<\|constrain\|>json)?\s*<\|message\|>([\s\S]*?)(?=<\|(?:call|end|return)\|>)/g;
  for (const match of content.matchAll(harmony)) {
    const name = normalizeToolName(match[1]);
    if (!name) continue;
    const args = match[2].trim();
    try {
      JSON.parse(args || '{}');
    } catch {
      continue;
    }
    calls.push({
      id: `call_${randomUUID().replaceAll('-', '')}`,
      type: 'function',
      function: {name, arguments: args || '{}'},
    });
  }
  return calls;
}

function normalizeCompletion(payload) {
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    const message = choice?.message;
    if (!message || Array.isArray(message.tool_calls) && message.tool_calls.length > 0) continue;

    const calls = parseHarmonyToolCalls(message.content);
    if (calls.length === 0) continue;

    message.tool_calls = calls;
    message.content = null;
    choice.finish_reason = 'tool_calls';
  }
  return payload;
}

globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const target = typeof args[0] === 'string'
    ? args[0]
    : args[0] instanceof URL
      ? args[0].href
      : args[0]?.url;

  if (!target?.includes('/chat/completions') || !response.ok) return response;

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return new Response(text, response);
  }

  const normalized = normalizeCompletion(payload);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(JSON.stringify(normalized), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
