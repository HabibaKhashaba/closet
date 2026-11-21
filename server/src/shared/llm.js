// Language-model client (Adapter) shared by Ask Closet, the AI stylist and photo tagging.
// One small interface over Anthropic or OpenAI, chosen by which key is set in server/.env:
//   ANTHROPIC_API_KEY (default model claude-haiku-4-5) or OPENAI_API_KEY (default gpt-4o-mini); LLM_MODEL overrides.
// The model never touches the database: callers pass it only the facts it may use, and every answer
// is validated by the caller. With no key, on an error or after the time-out, callers fall back to
// Closet's own rules and say so ("via": "rules"), so the app always works and is never mislabelled.
function createLlm({ env = process.env, fetchImpl = (...a) => fetch(...a), timeoutMs = 12000 } = {}) {
  const provider = env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : null;
  const model = env.LLM_MODEL || (provider === 'anthropic' ? 'claude-haiku-4-5' : provider === 'openai' ? 'gpt-4o-mini' : null);

  // content: [{ type:'text', text } | { type:'image', mime, base64 }]
  async function call({ system, content, maxTokens = 400, tool }) {
    if (!provider) throw new Error('no language model configured');
    const signal = AbortSignal.timeout(timeoutMs);
    if (provider === 'anthropic') {
      const parts = content.map((c) => (c.type === 'image'
        ? { type: 'image', source: { type: 'base64', media_type: c.mime, data: c.base64 } }
        : { type: 'text', text: c.text }));
      const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: parts }] };
      if (tool) Object.assign(body, { tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema }], tool_choice: { type: 'tool', name: tool.name } });
      const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`language model error ${res.status}`);
      const data = await res.json();
      if (tool) {
        const use = (data.content || []).find((c) => c.type === 'tool_use');
        if (!use) throw new Error('no tool call');
        return use.input;
      }
      return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    }
    const parts = content.map((c) => (c.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${c.mime};base64,${c.base64}` } }
      : { type: 'text', text: c.text }));
    const body = { model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: parts }] };
    if (tool) Object.assign(body, { tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.schema } }], tool_choice: { type: 'function', function: { name: tool.name } } });
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`language model error ${res.status}`);
    const data = await res.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) throw new Error('empty answer');
    if (tool) {
      const tc = msg.tool_calls && msg.tool_calls[0];
      if (!tc) throw new Error('no tool call');
      return JSON.parse(tc.function.arguments);
    }
    return String(msg.content || '').trim();
  }

  return {
    provider, model,
    enabled: Boolean(provider),
    label: provider ? `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} · ${model}` : null,
    text: (system, text, maxTokens) => call({ system, content: [{ type: 'text', text }], maxTokens }),
    tool: (system, content, tool, maxTokens) => call({ system, content, tool, maxTokens }),
  };
}

module.exports = { createLlm };
