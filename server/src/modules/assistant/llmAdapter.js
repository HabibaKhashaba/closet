// Language Model Adapter «Adapter» (IIntentParser). The model may only pick ONE of our
// whitelisted functions and fill its arguments; it never sees the database and cannot invent pieces.
// Configure with ANTHROPIC_API_KEY or OPENAI_API_KEY. With no key, or on error or after 8 s,
// the keyword parser answers instead, so Ask Closet always works.
const { parse, FUNCTIONS } = require('./keywordParser');
const { OCCASIONS, STYLES, STATUSES, COLOURS, CATEGORIES } = require('../../shared/vocabulary');

const SCHEMA = {
  type: 'object',
  properties: {
    fn: { type: 'string', enum: FUNCTIONS },
    occasion: { type: 'string', enum: Object.keys(OCCASIONS) },
    style: { type: 'string', enum: STYLES },
    date: { type: 'string', description: 'YYYY-MM-DD' },
    slot: { type: 'integer', minimum: 0, maximum: 3, description: '0 top/dress, 1 bottom/layer, 2 shoes, 3 extra' },
    status: { type: 'string', enum: STATUSES },
    colour: { type: 'string', enum: COLOURS },
    category: { type: 'string', enum: CATEGORIES },
    text: { type: 'string' },
    replacement: { type: 'boolean', description: 'add_to_shopping: replaces a piece the user owns' },
    name: { type: 'string', description: 'garment word from the message, e.g. blazer, loafers' },
    days: { type: 'integer', minimum: 1, maximum: 14 },
    destination: { type: 'string' },
    carryOn: { type: 'boolean' },
    how: { type: 'string', enum: ['donate', 'give', 'sell'] },
    direction: { type: 'string', enum: ['pack', 'bring_back'] },
    impact: { type: 'boolean', description: 'buy_check: "what would it add"' },
    useContext: { type: 'boolean', description: 'the message says it / this / that' },
  },
  required: ['fn'],
};

const SYSTEM = (today) => `You route requests for Closet, a wardrobe app. Today is ${today}. Choose exactly one function:
recommend (outfit ideas; occasion, style, date), change_piece (swap one slot of the last outfit), set_status (colour, category, status),
wash_done, forgotten, style_piece (colour, category), closet_needs (what is missing / what to buy),
buy_check ("should I buy X" / "what would X add"; colour, category, impact), add_to_shopping (put X on the shopping list, or a replacement for a piece; colour, category, replacement, text), similar_owned ("do I own something like X"; colour, category), weather (date), hide_piece (colour, category), plan_event (text),
availability ("is my X clean/available"), laundry_list, laundry_risk ("do I need to do laundry before ..."), week_plan (days), borrowed ("who has my X"), donate_candidates, keep_piece, rehome_piece (how), rehome_done (how), seasonal (direction), memory (text), repeat_check, health, plan_check, event_rescue (occasion, date), trip_pack (destination, days, carryOn), value (cost per wear), help.
Call the tool "route" once. Never answer in prose.`;

function toCall(o) {
  const piece = o.colour || o.category ? { ...(o.colour && { colour: o.colour }), ...(o.category && { category: o.category }) } : undefined;
  const piece2 = piece && o.name ? { ...piece, name: o.name } : piece;
  const args = { occasion: o.occasion, style: o.style, date: o.date, slot: o.slot, status: o.status, text: o.text, piece: piece2, replacement: o.replacement,
    days: o.days, destination: o.destination, carryOn: o.carryOn, how: o.how, direction: o.direction, impact: o.impact, useContext: o.useContext };
  Object.keys(args).forEach((k) => args[k] === undefined && delete args[k]);
  if ((o.fn === 'recommend' || o.fn === 'event_rescue') && !args.occasion) args.occasion = 'Everyday';
  return { fn: FUNCTIONS.includes(o.fn) ? o.fn : 'help', args };
}

function llmAdapter({ env = process.env, fetchImpl = (...a) => fetch(...a), timeoutMs = 8000 } = {}) {
  const provider = env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : null;
  async function ask(message) {
    const today = new Date().toISOString().slice(0, 10);
    const signal = AbortSignal.timeout(timeoutMs);
    if (provider === 'anthropic') {
      const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.LLM_MODEL || 'claude-haiku-4-5', max_tokens: 200, system: SYSTEM(today),
          tools: [{ name: 'route', description: 'Route the request to a Closet function', input_schema: SCHEMA }], tool_choice: { type: 'tool', name: 'route' },
          messages: [{ role: 'user', content: message }] }),
      });
      const data = await res.json();
      const use = (data.content || []).find((c) => c.type === 'tool_use');
      if (!use) throw new Error('no tool call');
      return toCall(use.input);
    }
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.LLM_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: SYSTEM(today) }, { role: 'user', content: message }],
        tools: [{ type: 'function', function: { name: 'route', parameters: SCHEMA } }], tool_choice: { type: 'function', function: { name: 'route' } } }),
    });
    const data = await res.json();
    const call = data.choices && data.choices[0].message.tool_calls && data.choices[0].message.tool_calls[0];
    if (!call) throw new Error('no tool call');
    return toCall(JSON.parse(call.function.arguments));
  }
  return {
    provider,
    // IIntentParser
    async interpret(message) {
      if (!provider) return { ...parse(message), via: 'keyword parser' };
      try { return { ...(await ask(message)), via: provider }; } catch (e) { return { ...parse(message), via: 'keyword parser (language model unavailable)' }; }
    },
  };
}

module.exports = { llmAdapter, toCall, SCHEMA };
