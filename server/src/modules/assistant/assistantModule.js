// Ask Closet (Chat): turns a message into ONE whitelisted Closet function and runs it only
// through other modules' interfaces (IRecommend, IWardrobe, IAvailability, the planner).
// Every change it makes is listed in the reply and can be undone (US-31, US-76).
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { canMove } = require('../availability/statusMachine');
const { CATEGORIES, COLOURS } = require('../../shared/vocabulary');

const UUID = /^[0-9a-f-]{36}$/i;
const SUGGESTIONS = ['What should I wear to university tomorrow?', 'I want to buy beige trousers. Do I need them?', 'Put beige trousers on my shopping list', 'Add a replacement for my torn loafers', 'What is missing from my wardrobe?', 'Style my blue skirt', 'What have I not worn recently?'];
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };
const label = (p) => p.name || [p.colour, p.fabric && p.fabric !== 'Other' ? p.fabric.toLowerCase() : null, NOUN[p.category]].filter(Boolean).join(' ');
const lower = (p) => label(p).toLowerCase();

function matchPieces(pieces, q) {
  if (!q) return [];
  return pieces.filter((p) => (!q.colour || p.colour === q.colour) && (!q.category || p.category === q.category) && (!q.fabric || p.fabric === q.fabric));
}

function assistantService({ db, parser, rec, outfits, wardrobe, availability, planner, shopping }) {
  async function logAction(userId, fn, undo) {
    const { rows } = await db.query('INSERT INTO assistant.actions (user_id, function, undo) VALUES ($1, $2, $3) RETURNING id', [userId, fn, JSON.stringify(undo)]);
    return rows[0].id;
  }
  async function resolve(userId, query, pieceId, filter = () => true) {
    const all = await wardrobe().allPieces(userId);
    if (pieceId) {
      const p = all.find((x) => x.id === pieceId);
      if (!p) throw errors.notFound('Piece');
      return { piece: p };
    }
    const found = matchPieces(all, query);
    const usable = found.filter(filter);
    if (usable.length === 1) return { piece: usable[0] };
    if (!found.length) return { none: true };
    return { choices: (usable.length ? usable : found).slice(0, 6) };
  }
  const describe = (q) => [q.colour, q.fabric, q.category ? NOUN[q.category] : 'piece'].filter(Boolean).join(' ').toLowerCase();

  const run = {
    async recommend(userId, a) {
      const r = await rec().recommend(userId, { occasion: a.occasion, style: a.style, date: a.date });
      if (!r.outfits.length) return { reply: r.note };
      const when = a.date ? ` on ${a.date}` : '';
      return { reply: `Here are ${r.outfits.length} ${r.levelName} outfits for ${a.occasion.toLowerCase()}${when} (${r.weather.tempC} °C${r.weather.source === 'estimate' ? ', estimated' : ''}). Say “change the shoes” to swap one piece.`, outfits: r.outfits, context: { occasion: a.occasion, style: a.style, date: a.date } };
    },
    async change_piece(userId, a, ctx) {
      if (!ctx || !ctx.itemIds) return { reply: 'Ask me for an outfit first, then I can change one piece of it.' };
      // The slot is found by category, not by position: a dress outfit has no bottom, so "the shoes" may be the 2nd piece.
      const SLOT_CATS = { 0: ['Top', 'Dress'], 1: ['Bottom', 'Layer'], 2: ['Shoes'], 3: ['Bag', 'Extra'] };
      const all = await wardrobe().allPieces(userId);
      const cats = ctx.itemIds.map((id) => (all.find((p) => p.id === id) || {}).category);
      const want = SLOT_CATS[a.slot ?? 2] || SLOT_CATS[2];
      const found = cats.findIndex((c) => want.includes(c));
      if (found < 0) return { reply: `This outfit has no ${a.slot === 3 ? 'bag or accessory' : a.slot === 1 ? 'bottom or layer' : a.slot === 0 ? 'top or dress' : 'shoes'} to change.`, context: ctx };
      const slot = found;
      const r = await rec().swap(userId, { itemIds: ctx.itemIds, slot, occasion: ctx.occasion || 'Everyday', style: ctx.style, date: ctx.date });
      if (!r.outfit) return { reply: r.note };
      const old = r.outfit.pieces[slot];
      return { reply: `Done. I changed only that piece: now the ${lower(old)}. The other pieces stay.`, outfits: [r.outfit], context: ctx };
    },
    async set_status(userId, a, ctx, pieceId) {
      const r = await resolve(userId, a.piece, pieceId, (p) => p.status !== a.status && canMove(p.status, a.status));
      if (r.none) return { reply: `I couldn’t find a ${describe(a.piece)} in your closet.` };
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = r.piece;
      if (p.status === a.status) return { reply: `Your ${lower(p)} is already ${a.status}.` };
      await availability.setStatus(userId, p.id, a.status);
      const undoId = await logAction(userId, 'set_status', { type: 'status', items: [{ id: p.id, status: p.status }] });
      return { reply: `Done: your ${lower(p)} is now ${a.status}.${a.status === 'Available' ? '' : ' It won’t appear in outfits until it’s back.'}`, pieces: [{ ...p, status: a.status }], undoId };
    },
    async wash_done(userId) {
      const ids = await availability.laundryIds(userId);
      if (!ids.length) return { reply: 'Your laundry basket is already empty.' };
      await availability.washDone(userId);
      const undoId = await logAction(userId, 'wash_done', { type: 'status', items: ids.map((id) => ({ id, status: 'Laundry' })) });
      return { reply: `Wash done: ${ids.length} piece${ids.length === 1 ? ' is' : 's are'} Available again.`, undoId };
    },
    async forgotten(userId) {
      const i = await outfits().insights(userId);
      if (!i.forgotten.length) return { reply: 'Nothing is forgotten: you have worn everything in the last 40 days.' };
      return { reply: `You haven’t worn these for over 40 days. Tap “Style this piece” to build outfits around one.`, pieces: i.forgotten.slice(0, 6), styleIt: true };
    },
    async style_piece(userId, a, ctx, pieceId) {
      const r = await resolve(userId, a.piece, pieceId);
      if (r.none) return { reply: `I couldn’t find a ${describe(a.piece)} in your closet.` };
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = r.piece;
      const occasion = a.occasion || 'Everyday';
      const level = a.occasion ? undefined : Math.min(...p.dressCodes); // use a level the piece suits
      const res = await rec().recommend(userId, { occasion, level, date: a.date, fixedId: p.id });
      if (!res.outfits.length) return { reply: res.note || `I couldn’t build an outfit around your ${lower(p)} right now.` };
      return { reply: `${res.outfits.length} ways to wear your ${lower(p)}:`, outfits: res.outfits, context: { occasion, date: a.date } };
    },
    async buy_check(userId, a) {
      if (!shopping || !a.piece || !a.piece.colour || !a.piece.category) return { reply: 'Tell me the colour and the kind of piece, for example “beige trousers”.' };
      const r = await shopping().check(userId, { category: a.piece.category, colour: a.piece.colour });
      const buy = { category: a.piece.category, colour: a.piece.colour, word: a.word || null };
      return { context: { buy }, reply: r.verdict === 'Skip' ? `Probably not. ${r.advice}` : r.duplicate ? `${r.verdict}. ${r.duplicate.message} ${r.advice}` : `${r.verdict}. ${r.advice}`, verdict: r.verdict, pieces: r.similarOwned.length ? r.similarOwned : r.pairsWith, piecesTitle: r.similarOwned.length ? 'Similar pieces you own' : 'It would pair with', outfitsUnlocked: r.outfitsUnlocked };
    },
    // US-36: "Put beige trousers on my shopping list" · "add this to my list" (after a buy check) ·
    // "Add a replacement for my torn loafers" (the piece is found in the closet; the list item says what it replaces).
    async add_to_shopping(userId, a, ctx) {
      if (!shopping) return { reply: 'Smart Shopping is not available.' };
      let q = a.piece || (a.useContext && ctx && ctx.buy) || null;
      let word = a.word || (q && q.word) || null;
      let reason = null; let replaces = null;
      if (a.replacement && q && q.category) {
        const all = await wardrobe().allPieces(userId);
        const owned = matchPieces(all, { colour: q.colour, category: q.category });
        const named = word ? owned.filter((p) => lower(p).includes(word.replace(/s$/, ''))) : [];
        const p = (named.length ? named : owned)[0];
        if (p) { q = { category: p.category, colour: p.colour }; word = word || NOUN[p.category]; replaces = lower(p); reason = `Your ${lower(p)} — ${a.damaged ? 'torn or damaged' : a.small ? 'too small' : 'to replace'}.`; }
        else { replaces = word || NOUN[q.category]; reason = `Replacement for your ${a.damaged ? 'torn ' : ''}${replaces}.`; }
      }
      if (!q || !q.category) return { reply: 'Tell me what to add — for example “put beige trousers on my shopping list”.' };
      const noun = word || NOUN[q.category];
      const title = `${q.colour ? `${q.colour} ` : ''}${noun}`.replace(/^./, (c) => c.toUpperCase());
      const r = await shopping().addToList(userId, { title, category: q.category, colour: q.colour, source: 'ask', reason: reason || 'You asked Ask Closet to add it.', replaces });
      if (!r.added) return { reply: `“${title}” is already on your shopping list.`, listItem: r.item };
      const undoId = await logAction(userId, 'add_to_shopping', { type: 'shopping', itemId: r.item.id });
      const warn = r.item.warning ? ` ${r.item.warning.replace(/\.$/, '')} — have a look before you buy.` : '';
      return { reply: `Added “${title}” to your shopping list.${warn}${r.note ? ` ${r.note}` : ''}`, listItem: r.item, pieces: r.item.similarOwned.length ? r.item.similarOwned : undefined, piecesTitle: 'Similar pieces you own', undoId };
    },
    async similar_owned(userId, a) {
      const all = await wardrobe().allPieces(userId);
      const q = a.piece || {};
      const exact = matchPieces(all, { colour: q.colour, category: q.category });
      const close = exact.length ? exact : all.filter((p) => p.category === q.category);
      if (!close.length) return { reply: `You don’t own anything like a ${describe(q)}. Ask “should I buy one?” to see what it would add.` };
      return { reply: exact.length ? `Yes — you own ${exact.length} ${describe(q)}${exact.length > 1 ? 's' : ''}:` : `Not the same colour, but you own ${close.length} ${NOUN[q.category]}${close.length > 1 ? 's' : ''}:`, pieces: close.slice(0, 6), styleIt: true };
    },
    async closet_needs(userId) {
      if (shopping) {
        const s = await shopping().suggestions(userId);
        if (s.suggestions.length) {
          return { reply: `Your closet is missing a few key pieces:\n• ${s.suggestions.slice(0, 4).map((x) => `${x.title} — ${x.reason}${x.outfitsUnlocked ? ` (+${x.outfitsUnlocked} outfits)` : ''}`).join('\n• ')}\nOpen Smart Shopping to see what each pairs with.`, shopping: s.suggestions.slice(0, 4) };
        }
      }
      const g = await wardrobe().gaps(userId);
      if (!g.gaps.length) return { reply: 'No gaps: you have at least two pieces of each kind for every level you dress for.' };
      const lines = g.gaps.slice(0, 5).map((x) => `${x.levelName} ${x.group.toLowerCase()}: ${x.count === 0 ? 'none' : 'only one'}`);
      return { reply: `Your closet is thin here:\n• ${lines.join('\n• ')}\nI only suggest real gaps, so you don’t buy what you already own.`, gaps: g.gaps };
    },
    async weather(userId, a) {
      const w = await rec().weather(userId, a.date);
      return { reply: `${w.place || 'Your city'}${a.date ? ` on ${w.date}` : ' today'}: ${w.tempC} °C (${w.low}–${w.high} °C), ${w.condition.toLowerCase()}${w.source === 'estimate' ? ` — an estimate: ${w.note.toLowerCase()}` : ''}.`, weather: w };
    },
    async hide_piece(userId, a, ctx, pieceId) {
      const r = await resolve(userId, a.piece, pieceId);
      if (r.none) return { reply: `I couldn’t find a ${describe(a.piece)} in your closet.` };
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      await outfits().hide(userId, r.piece.id, 7);
      const undoId = await logAction(userId, 'hide_piece', { type: 'hide', itemId: r.piece.id });
      return { reply: `I won’t suggest your ${lower(r.piece)} for 7 days. It doesn’t count as a dislike.`, undoId };
    },
    async plan_event(userId, a) {
      const events = await planner().upcoming(userId, 14);
      if (!events.length) return { reply: 'You have no events in the next two weeks. Add one in the Planner.' };
      const words = (a.text || '').split(/\W+/).filter((w) => w.length > 3);
      const e = events.find((x) => words.some((w) => x.title.toLowerCase().includes(w))) || events[0];
      const r = await planner().recommendFor(userId, e.id);
      return { reply: `For “${e.title}” on ${e.date} (${e.occasion}, ${r.levelName}, ${r.weather.tempC} °C), here are ${r.outfits.length} options. Open the Planner to choose one.`, outfits: r.outfits, eventId: e.id, context: { occasion: e.occasion, date: e.date } };
    },
    async help() {
      return { reply: 'I can suggest outfits, style one piece, change one piece, move pieces to the laundry or back, tell you the weather, find forgotten pieces, check what you already own, whether a purchase is worth it, and put things on your shopping list. Try one of these:', suggestions: SUGGESTIONS };
    },
  };

  return {
    async chat(userId, { message, context, pieceId }) {
      const intent = await parser.interpret(message);
      const result = await run[intent.fn](userId, intent.args || {}, context, pieceId);
      return { function: intent.fn, args: intent.args, via: intent.via, ...result };
    },
    async undo(userId, id) {
      if (!UUID.test(id)) throw errors.notFound('Action');
      const { rows } = await db.query('SELECT * FROM assistant.actions WHERE id = $1 AND user_id = $2', [id, userId]);
      const a = rows[0];
      if (!a) throw errors.notFound('Action');
      if (a.undone) throw errors.conflict('ALREADY_UNDONE', 'This change was already undone.');
      if (a.undo.type === 'status') for (const it of a.undo.items) await availability.restore(userId, it.id, it.status);
      if (a.undo.type === 'hide') await outfits().unhide(userId, a.undo.itemId);
      if (a.undo.type === 'shopping') await shopping().removeFromList(userId, a.undo.itemId).catch(() => null);
      await db.query('UPDATE assistant.actions SET undone = true WHERE id = $1', [id]);
      return { undone: true, function: a.function };
    },
    suggestions: SUGGESTIONS,
  };
}

function registerAssistant(deps) {
  const service = assistantService(deps);
  const r = express.Router();
  r.get('/', (req, res) => res.json({ suggestions: SUGGESTIONS, languageModel: deps.parser.provider || 'keyword parser' }));
  r.post('/', v.body({ message: { type: 'string', required: true, min: 1, max: 500, label: 'Message' }, pieceId: { type: 'string', max: 36 } }), async (req, res, next) => {
    try {
      const ctx = req.body.context && typeof req.body.context === 'object' ? req.body.context : null;
      if (ctx && ctx.itemIds && (!Array.isArray(ctx.itemIds) || !ctx.itemIds.every((x) => UUID.test(x)) || ctx.itemIds.length > 4)) throw errors.validation([{ field: 'context', message: 'Invalid outfit' }]);
      if (req.valid.pieceId && !UUID.test(req.valid.pieceId)) throw errors.notFound('Piece');
      // A remembered “do I need …?” item may only name values from the shared vocabulary.
      if (ctx && ctx.buy && (!CATEGORIES.includes(ctx.buy.category) || (ctx.buy.colour && !COLOURS.includes(ctx.buy.colour)))) delete ctx.buy;
      res.json(await service.chat(req.user.id, { message: req.valid.message, context: ctx, pieceId: req.valid.pieceId }));
    } catch (e) { next(e); }
  });
  r.post('/undo/:id', async (req, res, next) => {
    try { res.json(await service.undo(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { registerAssistant, matchPieces, SUGGESTIONS };
