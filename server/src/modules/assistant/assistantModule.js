// Ask Closet (Chat): turns a message into ONE whitelisted Closet function and runs it only
// through other modules' interfaces (IRecommend, IWardrobe, IAvailability, the planner).
// Every change it makes is listed in the reply and can be undone (US-31, US-76).
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { canMove } = require('../availability/statusMachine');
const { CATEGORIES, COLOURS } = require('../../shared/vocabulary');

const UUID = /^[0-9a-f-]{36}$/i;
const SUGGESTIONS = ['What should I wear to university tomorrow?', 'Is my blazer clean?', 'What needs repair?', 'Who has my black blazer?', 'What clothes are ready to donate?', 'Do I need beige trousers?', 'What could I donate?', 'Do I need to do laundry before Monday?', 'Pack me for 5 days in Paris', 'Who has my rose wrap dress?', 'What has the best cost per wear?', 'Why is my wardrobe health low?', 'What is missing from my wardrobe?'];
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };
const label = (p) => p.name || [p.colour, p.fabric && p.fabric !== 'Other' ? p.fabric.toLowerCase() : null, NOUN[p.category]].filter(Boolean).join(' ');
const lower = (p) => label(p).toLowerCase();

function matchPieces(pieces, q) {
  if (!q) return [];
  const base = pieces.filter((p) => (!q.colour || p.colour === q.colour) && (!q.category || p.category === q.category) && (!q.fabric || p.fabric === q.fabric));
  // A garment word ("blazer", "loafers") narrows to pieces with that word in their name, when there are any.
  if (!q.name) return base;
  const stem = q.name.replace(/s$/, '');
  const named = base.filter((p) => String(p.name || '').toLowerCase().includes(stem));
  return named.length ? named : base;
}
const { WHERE: WHERE_STATE, LABEL, onDay } = require('../../shared/lifecycle');
const WHERE = { ...WHERE_STATE, Available: 'Available — clean and at home' };
const SCOPE = 'I can help with your wardrobe, outfits, laundry, shopping, weather and planner.';

function assistantRepository(db) {
  return {
    async log(userId, fn, undo) { return (await db.query('INSERT INTO assistant.actions (user_id, function, undo) VALUES ($1, $2, $3) RETURNING id', [userId, fn, JSON.stringify(undo)])).rows[0].id; },
    async get(userId, id) { return (await db.query('SELECT * FROM assistant.actions WHERE id = $1 AND user_id = $2', [id, userId])).rows[0] || null; },
    async markUndone(id) { await db.query('UPDATE assistant.actions SET undone = true WHERE id = $1', [id]); },
  };
}

function assistantService({ db, repo: givenRepo, parser, rec, outfits, wardrobe, availability, planner, shopping, proactive, intelligence, packing, profile }) {
  const repo = givenRepo || assistantRepository(db);
  async function logAction(userId, fn, undo) { return repo.log(userId, fn, undo); }
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
    if (found.length === 1) return { piece: found[0] };
    return { choices: (usable.length ? usable : found).slice(0, 6) };
  }
  const describe = (q) => [q.colour, q.fabric, q.name || (q.category ? NOUN[q.category] : 'piece')].filter(Boolean).join(' ').toLowerCase();
  // The piece a follow-up ("keep it", "add this") refers to: named now, or remembered from the last reply.
  async function pieceFor(userId, a, ctx, pieceId, filter) {
    if (a.piece) return resolve(userId, a.piece, pieceId, filter);
    const id = pieceId || (a.useContext && ctx && ctx.pieceId);
    if (id) return resolve(userId, null, id);
    return { none: true, missing: true };
  }
  const notFound = (a) => ({ reply: a.piece ? `I couldn’t find a ${describe(a.piece)} in your closet.` : 'Which piece do you mean? Name it, for example “the denim jacket”.' });
  const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
  const addDays = (day, n) => isoDay(new Date(`${day}T12:00:00Z`).getTime() + n * 86400000);

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
      if (p.status === a.status) return { reply: `Your ${lower(p)} is already ${WHERE_STATE[a.status]}.` };
      await availability.setStatus(userId, p.id, a.status, a.reason ? { care: { reason: a.reason } } : {});
      const undoId = await logAction(userId, 'set_status', { type: 'status', items: [{ id: p.id, status: p.status }] });
      return { reply: `Done: your ${lower(p)} is now ${a.status === 'Laundry' ? 'Laundry' : LABEL[a.status]}.${a.status === 'Available' ? '' : ' It won’t appear in outfits until it’s back.'}`, pieces: [{ ...p, status: a.status }], undoId };
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
      if (shopping && a.piece && a.piece.category && (a.impact || !a.piece.colour)) {
        const im = await shopping().impact(userId, { category: a.piece.category, colour: a.piece.colour, name: a.word || a.piece.name || undefined });
        const buy = { category: a.piece.category, colour: a.piece.colour || null, word: a.word || null };
        return { context: { buy }, reply: `${im.sentence} Recommendation: ${im.recommendation}.${im.fillsGap ? ` It fills a ${im.fillsGap.confidence.toLowerCase()}-confidence ${im.fillsGap.levelName.toLowerCase()} gap.` : ''}${im.similarOwned ? ` You own ${im.similarOwned} similar piece${im.similarOwned === 1 ? '' : 's'}.` : ''} (Simulated — nothing was added to your closet.)`, impact: im, pieces: im.similar.length ? im.similar : undefined, piecesTitle: 'Similar pieces you own' };
      }
      if (!shopping || !a.piece || !a.piece.colour || !a.piece.category) return { reply: 'Tell me the colour and the kind of piece, for example “beige trousers”.' };
      const r = await shopping().check(userId, { category: a.piece.category, colour: a.piece.colour, name: a.word || a.piece.name || undefined });
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
    // ---------- v1.5: questions that READ state ----------
    async availability(userId, a, ctx, pieceId) {
      const r = await resolve(userId, a.piece, pieceId);
      if (r.none) return notFound(a);
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = r.piece;
      if (a.tailor && p.status !== 'At tailor') {
        const why = p.care ? ` It ${p.status === 'Needs alteration' ? 'needs an alteration' : 'needs a repair'} (${p.care.reason.toLowerCase()}) but hasn’t been sent yet.` : '';
        return { reply: `Your ${lower(p)} isn’t at the tailor — it is ${WHERE_STATE[p.status]}.${why}`, pieces: [p], context: { pieceId: p.id } };
      }
      let extra = '';
      if (p.status === 'Borrowed') extra = `${p.statusNote ? ` (with ${p.statusNote})` : ''}${p.expectedBack ? `, expected back ${onDay(p.expectedBack)}` : ''}`;
      else if (p.status === 'At tailor') extra = `${p.care && p.care.tailor ? ` (${p.care.tailor})` : ''}${p.care ? ` for ${p.care.kind === 'alteration' ? 'an alteration' : 'a repair'}: ${p.care.reason.toLowerCase()}` : ''}${p.expectedBack ? `. Expected back ${p.expectedBack}` : ''}`;
      else if (p.care) extra = ` (${p.care.reason.toLowerCase()})`;
      else if (p.status !== 'Available' && p.expectedBack) extra = `, expected back ${onDay(p.expectedBack)}`;
      return { reply: `Your ${lower(p)} is ${WHERE[p.status]}${extra}.`, pieces: [p], context: { pieceId: p.id } };
    },
    async laundry_list(userId) {
      const ids = await availability.laundryIds(userId);
      if (!ids.length) return { reply: 'Nothing needs washing: your laundry basket is empty.' };
      const pieces = (await wardrobe().allPieces(userId)).filter((p) => ids.includes(p.id));
      return { reply: `${pieces.length} piece${pieces.length === 1 ? ' is' : 's are'} in your laundry basket. Say “laundry is done” when they’re clean.`, pieces, piecesTitle: 'In the laundry' };
    },
    async laundry_risk(userId) {
      const r = await proactive().laundryRisk(userId);
      const ids = await availability.laundryIds(userId);
      if (!r.warnings.length) return { reply: ids.length ? `No rush. ${ids.length} piece${ids.length === 1 ? ' is' : 's are'} in the laundry, but your most-worn pieces for your upcoming plans are clean.` : 'No — your laundry basket is empty.' };
      return { reply: r.warnings.map((w) => w.message).join('\n'), pieces: r.warnings[0].pieces, piecesTitle: 'Wash these first' };
    },
    async week_plan(userId, a) {
      const r = await proactive().planDays(userId, { days: Math.min(7, Math.max(1, a.days || 4)) });
      const lines = r.days.map((d) => `${new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.event || d.occasion}: ${d.outfit ? d.outfit.pieces.map((p) => lower(p)).join(', ') : d.note}`);
      return { reply: `Here’s a plan for ${r.days.length} days${r.repeatsAllowed ? '' : ' — no top, bottom or dress twice before a wash'}:\n• ${lines.join('\n• ')}`, outfits: r.days.filter((d) => d.outfit).map((d) => d.outfit).slice(0, 3) };
    },
    async borrowed(userId, a, ctx, pieceId) {
      const b = await proactive().borrowed(userId);
      if (a.piece) {
        const r = await resolve(userId, a.piece, pieceId, (p) => p.status === 'Borrowed');
        if (r.none) return notFound(a);
        if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
        const hit = b.borrowed.find((x) => x.id === r.piece.id);
        return hit ? { reply: hit.message, pieces: [r.piece], context: { pieceId: r.piece.id } } : { reply: `Your ${lower(r.piece)} isn’t lent out — it is ${WHERE[r.piece.status]}.`, context: { pieceId: r.piece.id } };
      }
      if (!b.borrowed.length) return { reply: 'You haven’t lent anything out.' };
      return { reply: b.borrowed.map((x) => x.message).join('\n'), pieces: b.borrowed.map((x) => x.piece), piecesTitle: 'Lent out' };
    },
    // ---------- v1.5: long-unworn pieces — the user always decides ----------
    async donate_candidates(userId) {
      const f = await proactive().forgotten(userId);
      if (!f.candidates.length) return { reply: 'Nothing stands out: every piece that’s in season has been worn recently. Closet only suggests pieces you haven’t worn in a long while.' };
      const c = f.candidates[0];
      return { reply: `You haven’t worn your ${lower(c.piece)} in ${c.days} days. I can style it again first, you can keep it, or you can mark it to donate to someone who may need it.${f.candidates.length > 1 ? ` ${f.candidates.length - 1} more piece${f.candidates.length === 2 ? '' : 's'} could be considered too.` : ''}`, pieces: f.candidates.slice(0, 4).map((x) => ({ ...x.piece, daysSince: x.days })), styleIt: true, context: { pieceId: c.id } };
    },
    async keep_piece(userId, a, ctx, pieceId) {
      const r = await pieceFor(userId, a, ctx, pieceId);
      if (r.none) return notFound(a);
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const k = await proactive().keep(userId, r.piece.id, {});
      const undoId = await logAction(userId, 'keep_piece', { type: 'snooze', key: `keep:${r.piece.id}` });
      return { reply: k.message, context: { pieceId: r.piece.id }, undoId };
    },
    async donate_piece(userId, a, ctx, pieceId) {
      const r = await pieceFor(userId, a, ctx, pieceId);
      if (r.none) return notFound(a);
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = await wardrobe().donate(userId, r.piece.id);
      const undoId = await logAction(userId, 'donate_piece', { type: 'donate', itemId: p.id });
      return { reply: `Marked your ${lower(p)} Ready to donate. It stays under Donation until it has left; Closet won’t suggest it in outfits meanwhile. When it’s gone, say “I donated the ${lower(p)}”.`, pieces: [p], context: { pieceId: p.id }, undoId };
    },
    async donate_done(userId, a, ctx, pieceId) {
      const r = await pieceFor(userId, a, ctx, pieceId);
      if (r.none) return notFound(a);
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = r.piece;
      if (p.status !== 'Ready to donate') {
        await wardrobe().donate(userId, p.id);
        return { reply: `I’ve marked your ${lower(p)} as ready to donate. Open Donation and tap “Mark as donated” to confirm it has left — that removes it from your active closet.`, pieces: [p], confirmDonation: p.id, context: { pieceId: p.id } };
      }
      const done = await wardrobe().donationDone(userId, p.id);
      return { reply: `${done.effect} Your ${lower(p)} has left your active closet. Nothing was added to your shopping bag.`, donated: done.piece };
    },
    async donation_list(userId) {
      const d = await wardrobe().donation(userId);
      if (!d.ready.length) return { reply: `Nothing is waiting to be donated.${d.count ? ` You have donated ${d.count} piece${d.count === 1 ? '' : 's'} so far.` : ''} Ask “What could I donate?” for ideas.` };
      return { reply: `${d.ready.length} piece${d.ready.length === 1 ? ' is' : 's are'} ready to donate: ${d.ready.map((p) => `${lower(p)} (marked ${p.markedOn})`).join(', ')}. Open Donation to mark them as donated once they’ve left.`, pieces: d.ready, piecesTitle: 'Ready to donate' };
    },
    // ---------- v1.6 Care and Borrow & lend ----------
    async care_list(userId) {
      const c = await availability.care(userId);
      const lines = [
        ...c.needsRepair.map((p) => `${label(p)} needs a repair: ${p.care ? p.care.reason.toLowerCase() : 'no reason given'}`),
        ...c.needsAlteration.map((p) => `${label(p)} needs an alteration: ${p.care ? p.care.reason.toLowerCase() : 'no reason given'}`),
        ...c.atTailor.map((p) => `${label(p)} is at the tailor${p.care && p.care.tailor ? ` (${p.care.tailor})` : ''}, expected back ${onDay(p.statusUntil)}${p.due ? ' — ready to collect' : ''}`),
      ];
      if (!lines.length) return { reply: `Nothing needs repair or alteration, and nothing is at the tailor.${c.laundry ? ` ${c.laundry} piece${c.laundry === 1 ? ' is' : 's are'} in the laundry.` : ''}` };
      return { reply: `• ${lines.join('\n• ')}`, pieces: [...c.needsRepair, ...c.needsAlteration, ...c.atTailor], piecesTitle: 'In Care' };
    },
    async lend_piece(userId, a, ctx, pieceId) {
      const r = await resolve(userId, a.piece, pieceId, (p) => p.status === 'Available');
      if (r.none) return notFound(a);
      if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
      const p = r.piece;
      if (p.status !== 'Available') return { reply: `Your ${lower(p)} is ${WHERE[p.status]}, so it can’t be lent right now.`, pieces: [p] };
      const due = a.date || addDays(isoDay(Date.now()), 7);
      await availability.lend(userId, p.id, { person: a.person, dueOn: due });
      const undoId = await logAction(userId, 'lend_piece', { type: 'lend', itemId: p.id });
      return { reply: `Done: your ${lower(p)} is lent to ${a.person}, due back ${onDay(due)}. It won’t appear in outfits until it’s back.`, pieces: [{ ...p, status: 'Borrowed' }], undoId, context: { pieceId: p.id } };
    },
    async unpacked(userId) {
      const trips = packing ? await packing().trips(userId) : [];
      const t = trips.filter((x) => x.endDate >= isoDay(Date.now())).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      if (!t) return { reply: 'You have no upcoming trip. Plan one in Packing.' };
      const pieces = (await wardrobe().allPieces(userId)).filter((p) => t.itemIds.includes(p.id));
      const left = pieces.filter((p) => p.status !== 'Packed');
      if (!left.length) return { reply: `Everything for ${t.destination} is packed (${pieces.length} pieces).` };
      const blocked = left.filter((p) => p.status !== 'Available');
      return { reply: `For ${t.destination} (${t.startDate}) you still need to pack ${left.length} of ${pieces.length} pieces.${blocked.length ? ` ${blocked.map((p) => `Your ${lower(p)} is ${WHERE[p.status]}`).join('; ')}.` : ''}`, pieces: left, piecesTitle: 'Not packed yet' };
    },
    async seasonal(userId, a) {
      const s = await proactive().seasonal(userId);
      if (a.direction === 'bring_back') {
        if (!s.bringBack.length) return { reply: `Nothing is in seasonal storage right now. At ${s.tempC} °C it feels like ${s.season ? s.season.toLowerCase() : 'mild weather'}.` };
        return { reply: `${s.bringBack.length} stored piece${s.bringBack.length === 1 ? ' is' : 's are'} ready to come back. Open Closet → Seasonal rotation to bring them back.`, pieces: s.bringBack, piecesTitle: 'Ready to bring back' };
      }
      if (!s.pack.length) return { reply: `Nothing is out of season at ${s.tempC} °C. Closet suggests storing pieces only when the weather really calls for it.` };
      return { reply: `${s.headline} Nothing changes until you choose “Pack for season”.`, pieces: s.pack, piecesTitle: 'Out of season now' };
    },
    async memory(userId, a) {
      const m = await proactive().memory(userId, { q: a.text, best: a.best });
      if (!m.matches.length) return { reply: 'I couldn’t find that in your outfit history. Outfits appear here after you tap “Wear this”.' };
      const line = (w) => `${w.date}${w.eventTitle ? ` · ${w.eventTitle}` : w.occasion ? ` · ${w.occasion}` : ''}${w.weather ? ` · ${w.weather.tempC} °C` : ''}${w.rating ? ` · ${'★'.repeat(w.rating)}` : ''}: ${w.pieces.map((p) => lower(p)).join(', ')}`;
      if (a.similar) {
        const w = m.matches[0];
        const r = await rec().recommend(userId, { occasion: w.occasion || 'Everyday' });
        return { reply: `You wore: ${line(w)}. Here are fresh looks in the same spirit (looks you rated highly rank higher):`, outfits: r.outfits, context: { occasion: w.occasion || 'Everyday' } };
      }
      return { reply: `${a.best ? 'Your best-rated looks' : 'From your outfit memory'}:\n• ${m.matches.map(line).join('\n• ')}`, pieces: m.matches[0].pieces, piecesTitle: m.matches[0].eventTitle || 'That look' };
    },
    async repeat_check(userId) {
      const h = await outfits().history(userId, {});
      const last = h.wears[0];
      if (!last) return { reply: 'You haven’t logged an outfit yet. Tap “Wear this” on a look to start your outfit memory.' };
      const pieces = await wardrobe().allPieces(userId);
      const away = last.pieces.find((p) => (pieces.find((x) => x.id === p.id) || {}).status !== 'Available');
      const r = await proactive().repeat(userId, last.pieces.map((p) => p.id));
      const msg = r.insight ? r.insight.message : 'Repeating a look you like is completely fine.';
      return { reply: `${msg}${away ? ` One thing: your ${lower(away)} is ${WHERE[(pieces.find((x) => x.id === away.id) || {}).status] || 'not available'}.` : ''}`, pieces: last.pieces, piecesTitle: `Worn ${last.date}` };
    },
    async health(userId) {
      const h = await intelligence().health(userId);
      return { reply: `Wardrobe Health: ${h.explain.summary}${h.explain.lowering.length ? `\nWhat lowers it:\n• ${h.explain.lowering.join('\n• ')}` : ''}${h.actions.length ? `\nTry: ${h.actions[0]}` : ''}`, health: { score: h.score, grade: h.grade } };
    },
    async plan_check(userId) {
      const m = await proactive().monitor(userId);
      if (!m.alerts.length) {
        const e = (await planner().upcoming(userId, 3)).find((x) => x.plannedOutfit);
        return { reply: e ? `Yes — your outfit for “${e.title}” still works: every piece is Available and the forecast (${e.weather ? `${e.weather.tempC} °C` : 'not available'}) hasn’t changed much.` : 'You have no planned outfits in the next few days.' };
      }
      return { reply: m.alerts.map((x) => x.message).join('\n'), alerts: m.alerts, link: '#/planner' };
    },
    async event_rescue(userId, a) {
      const r = await proactive().rescue(userId, { occasion: a.occasion, date: a.date || null });
      if (r.solved) return { reply: r.message, outfits: r.outfits, context: { occasion: a.occasion, date: a.date } };
      return { reply: r.message, gaps: r.gap ? [r.gap] : [], shopping: r.shopping };
    },
    async trip_pack(userId, a) {
      const start = a.date || addDays(isoDay(Date.now()), 7);
      const days = Math.min(14, Math.max(1, a.days || 4));
      const trip = { destination: a.destination || 'your trip', startDate: start, endDate: addDays(start, days - 1), tripType: a.business ? 'Work' : 'Travel', activities: a.business ? ['Work', 'Dinner'] : ['Travel', 'Everyday', 'Dinner'], carryOn: a.carryOn };
      const p = await packing().plan(userId, trip);
      return { reply: `${a.destination ? `${a.destination}, ` : ''}${days} days${a.carryOn ? ', carry-on' : ''}: ${p.summary}${p.fitsLimit === false ? ' It does not fit the luggage limit — open Packing to remove a piece.' : ''}${p.reuse.length ? ` Pieces worn more than once: ${p.reuse.slice(0, 3).map((x) => x.name.toLowerCase()).join(', ')}.` : ''}`, pieces: p.items, piecesTitle: 'Packing list', link: '#/packing' };
    },
    async value(userId, a, ctx, pieceId) {
      if (a.piece) {
        const r = await resolve(userId, a.piece, pieceId);
        if (r.none) return notFound(a);
        if (r.choices) return { reply: `Which ${describe(a.piece)}?`, choices: r.choices };
        const c = r.piece.costPerWear;
        if (!c || !c.hasPrice) return { reply: `Add a purchase price to your ${lower(r.piece)} to see its cost per wear.`, context: { pieceId: r.piece.id } };
        return { reply: c.perWear === null ? `Your ${lower(r.piece)} hasn’t been worn yet, so there’s no cost per wear.` : `Your ${lower(r.piece)}: ${c.text}.`, pieces: [r.piece], context: { pieceId: r.piece.id } };
      }
      const v2 = await proactive().value(userId);
      if (!v2.bestValue.length) return { reply: 'Add purchase prices to a few pieces (optional) and wear them — cost per wear counts only outfits you actually wore.' };
      return { reply: `Best value so far:\n• ${v2.bestValue.map((x) => `${x.piece.name}: ${x.text}`).join('\n• ')}${v2.underused[0] ? `\nLeast used for its price: ${v2.underused[0].piece.name}${v2.underused[0].perWear ? ` (${v2.underused[0].text})` : ' (not worn yet)'}.` : ''}${v2.note ? `\n${v2.note}` : ''}` };
    },
    async help(userId, a = {}) {
      if (a.outOfScope) return { reply: `${SCOPE} Try one of these:`, suggestions: SUGGESTIONS.slice(0, 5) };
      return { reply: 'I can suggest outfits, style or change one piece, move pieces to the laundry or back, tell you what’s clean or lent out, plan several days or a trip, find pieces you haven’t worn (to style, keep or donate), explain your Wardrobe Health and cost per wear, check what a purchase would add, and keep your shopping list. Try one of these:', suggestions: SUGGESTIONS };
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
      const a = await repo.get(userId, id);
      if (!a) throw errors.notFound('Action');
      if (a.undone) throw errors.conflict('ALREADY_UNDONE', 'This change was already undone.');
      if (a.undo.type === 'status') for (const it of a.undo.items) await availability.restore(userId, it.id, it.status);
      if (a.undo.type === 'hide') await outfits().unhide(userId, a.undo.itemId);
      if (a.undo.type === 'shopping') await shopping().removeFromList(userId, a.undo.itemId).catch(() => null);
      if (a.undo.type === 'snooze') await proactive().unsnooze(userId, a.undo.key);
      if (a.undo.type === 'donate') await wardrobe().cancelDonation(userId, a.undo.itemId).catch(() => null);
      if (a.undo.type === 'lend') await availability.returned(userId, a.undo.itemId).catch(() => null);
      await repo.markUndone(id);
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
      if (ctx && ctx.pieceId !== undefined && !UUID.test(String(ctx.pieceId))) delete ctx.pieceId;
      res.json(await service.chat(req.user.id, { message: req.valid.message, context: ctx, pieceId: req.valid.pieceId }));
    } catch (e) { next(e); }
  });
  r.post('/undo/:id', async (req, res, next) => {
    try { res.json(await service.undo(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { registerAssistant, assistantService, assistantRepository, matchPieces, SUGGESTIONS };
