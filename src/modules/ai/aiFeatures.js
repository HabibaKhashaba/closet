// AI features (v2.1): what the language model adds on top of Closet's rules.
//   1. composeReply  — Ask Closet answers in natural language, written ONLY from the facts the
//                      wardrobe functions returned (grounded generation; the rules still decide).
//   2. stylistNotes  — one stylist sentence per recommended look, about the real pieces in it.
//   3. tagPhoto      — reads a clothing photo and proposes category, colour, fabric, season, styles,
//                      dress codes and a name; the user confirms before anything is saved.
// Every function returns null when no model is configured or the model fails, and every answer is
// validated against Closet's vocabulary or the facts given, so the app never shows invented data.
const { CATEGORIES, COLOURS, FABRICS, SEASONS, STYLES } = require('../../shared/vocabulary');

const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- 1. Ask Closet: grounded natural-language reply ----------
const REPLY_SYSTEM = `You are the voice of Closet, a personal wardrobe assistant.
You receive the user's message, the recent conversation, and FACTS computed by the app from the user's real wardrobe.
Write the answer to the user in 1 to 3 short, warm, natural sentences.
Rules: use ONLY the facts. Never invent clothes, colours, numbers, dates, people or actions that are not in the facts.
If the facts list pieces or outfits, refer to them by their names exactly as given. If the facts say something was changed, say it was done.
If the facts say nothing was found, say so plainly. No markdown, no lists, no emoji.`;

async function composeReply(llm, { message, history = [], draft, facts = {} }) {
  if (!llm || !llm.enabled || !draft) return null;
  const convo = history.slice(-4).map((h) => `${h.who === 'ai' ? 'Closet' : 'User'}: ${clean(h.text, 300)}`).join('\n');
  const input = [
    convo && `Recent conversation:\n${convo}`,
    `User: ${clean(message, 500)}`,
    `FACTS (from the app):\nAnswer the app would give: ${clean(draft, 900)}`,
    facts.pieces && facts.pieces.length ? `Pieces shown: ${facts.pieces.join('; ')}` : '',
    facts.outfits && facts.outfits.length ? `Outfits shown: ${facts.outfits.map((o, i) => `${i + 1}) ${o}`).join(' | ')}` : '',
  ].filter(Boolean).join('\n\n');
  try {
    const out = clean(await llm.text(REPLY_SYSTEM, input, 220), 700);
    return out.length >= 2 ? out : null;
  } catch { return null; }
}

// ---------- 2. AI stylist notes for the three looks ----------
const STYLIST_SYSTEM = `You are a personal stylist inside the Closet app. For each outfit you receive (built by the app from the user's own available clothes),
write ONE sentence (max 30 words) on why it works or how to wear it, mentioning at least one of its pieces by name.
Use only the pieces, occasion and weather given. Do not suggest pieces that are not listed. Return one note per outfit, in order.`;
const STYLIST_TOOL = {
  name: 'stylist_notes',
  description: 'One stylist note per outfit, in the same order as given.',
  schema: { type: 'object', properties: { notes: { type: 'array', items: { type: 'string' } } }, required: ['notes'] },
};

async function stylistNotes(llm, { occasion, weather, outfits }) {
  if (!llm || !llm.enabled || !Array.isArray(outfits) || !outfits.length) return null;
  const text = [`Occasion: ${occasion || 'Everyday'}`, weather ? `Weather: ${weather}` : '',
    ...outfits.map((o, i) => `Outfit ${i + 1}: ${o.pieces.join(', ')}`)].filter(Boolean).join('\n');
  try {
    const r = await llm.tool(STYLIST_SYSTEM, [{ type: 'text', text }], STYLIST_TOOL, 500);
    const notes = Array.isArray(r && r.notes) ? r.notes.map((n) => clean(n, 240)) : [];
    if (notes.length !== outfits.length || notes.some((n) => n.length < 8)) return null;
    // Grounding check: each note must name at least one word of a piece in its own outfit.
    const grounded = notes.every((n, i) => outfits[i].pieces.some((p) => p.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => n.toLowerCase().includes(w))));
    return grounded ? notes : null;
  } catch { return null; }
}

// ---------- 3. Photo tagging (vision) ----------
const TAG_SYSTEM = `You look at ONE photo of a clothing item for a wardrobe app and describe it with the app's fixed vocabulary.
If the photo does not show a single clothing item, shoes, bag or accessory, set isClothing to false.`;
const TAG_TOOL = {
  name: 'describe_piece',
  description: 'Describe the clothing item in the photo using only the allowed values.',
  schema: {
    type: 'object',
    properties: {
      isClothing: { type: 'boolean' },
      name: { type: 'string', description: 'short name, 2-4 words, e.g. "Navy wool blazer"' },
      category: { type: 'string', enum: CATEGORIES, description: 'Top, Dress, Bottom, Layer (outerwear), Shoes, Bag, Extra (accessory)' },
      colour: { type: 'string', enum: COLOURS },
      fabric: { type: 'string', enum: FABRICS },
      season: { type: 'string', enum: SEASONS },
      styles: { type: 'array', items: { type: 'string', enum: STYLES }, maxItems: 3 },
      dressCodes: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 5 }, description: '1 Casual, 2 Smart Casual, 3 Business Casual, 4 Semi-Formal, 5 Formal; the levels it suits' },
    },
    required: ['isClothing'],
  },
};

async function tagPhoto(llm, { base64, mime }) {
  if (!llm || !llm.enabled) return null;
  try {
    const r = await llm.tool(TAG_SYSTEM, [{ type: 'image', mime, base64 }, { type: 'text', text: 'Describe this item.' }], TAG_TOOL, 300);
    if (!r || r.isClothing === false) return { isClothing: false };
    const out = { isClothing: true };
    if (CATEGORIES.includes(r.category)) out.category = r.category;
    if (COLOURS.includes(r.colour)) out.colour = r.colour;
    if (FABRICS.includes(r.fabric)) out.fabric = r.fabric;
    if (SEASONS.includes(r.season)) out.season = r.season;
    if (Array.isArray(r.styles)) out.styles = [...new Set(r.styles.filter((s) => STYLES.includes(s)))].slice(0, 3);
    if (Array.isArray(r.dressCodes)) out.dressCodes = [...new Set(r.dressCodes.map(Number).filter((n) => n >= 1 && n <= 5))].sort();
    if (r.name) out.name = clean(r.name, 60);
    return out;
  } catch { return null; }
}

module.exports = { composeReply, stylistNotes, tagPhoto, REPLY_SYSTEM, STYLIST_SYSTEM };
