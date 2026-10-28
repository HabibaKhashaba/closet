// Smart Shopping (Sprint 3, built early): the shopping list (US-36) and the suggestions behind it.
//   Shopping list sources: Ask Closet ("put beige trousers on my shopping list"), replacements for
//   pieces deleted as Torn / damaged or Became too small (US-33, via the ItemDeleted event),
//   closet gaps (US-64) and smart suggestions (basics that unlock outfits).
//   Never: a replacement or suggestion that matches a piece deleted as "No longer my style" (US-34).
//   "Do I need this?" (US-88) and the duplicate warning (US-65) use the similarity score below.
// Requires IWardrobe, IPreferences and the engine; owns only shopping.decisions and shopping.list_items.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { CATEGORIES, COLOURS, DRESS_CODES, STYLES, SEASONS } = require('../../shared/vocabulary');
const engine = require('../recommendation/engine');
const { TOPICS } = require('../../events/eventBus');
const { replacementFor, isAvoided } = require('../../shared/deletionPolicy');
const { levelsUserDressesFor, closetGaps } = require('../wardrobe/closetGaps');
const ins = require('../intelligence/insights');

const NEUTRALS = engine.NEUTRALS;
// A small capsule: if none of these exists, outfits are much harder to build.
const BASICS = [
  { key: 'basic-white-shirt', title: 'White button-down shirt', category: 'Top', colour: 'White', dressCodes: [1, 2, 3], styles: ['Classic', 'Minimal'], has: (p) => p.category === 'Top' && p.colour === 'White' && p.dressCodes.includes(3) },
  { key: 'basic-black-trousers', title: 'Black tailored trousers', category: 'Bottom', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic', 'Minimal'], has: (p) => p.category === 'Bottom' && p.colour === 'Black' && p.dressCodes.includes(3) },
  { key: 'basic-neutral-layer', title: 'Neutral blazer or trench', category: 'Layer', colour: 'Beige', dressCodes: [2, 3, 4], styles: ['Classic', 'Chic'], has: (p) => p.category === 'Layer' && NEUTRALS.includes(p.colour) && p.dressCodes.includes(3) },
  { key: 'basic-white-sneakers', title: 'White leather sneakers', category: 'Shoes', colour: 'White', dressCodes: [1, 2], styles: ['Casual', 'Minimal'], has: (p) => p.category === 'Shoes' && p.dressCodes.includes(1) && ['White', 'Beige'].includes(p.colour) },
  { key: 'basic-formal-shoes', title: 'Nude or black heels', category: 'Shoes', colour: 'Beige', dressCodes: [4, 5], styles: ['Elegant', 'Classic'], has: (p) => p.category === 'Shoes' && p.dressCodes.includes(5) },
  { key: 'basic-day-bag', title: 'Structured neutral bag', category: 'Bag', colour: 'Black', dressCodes: [2, 3, 4], styles: ['Classic', 'Chic'], has: (p) => p.category === 'Bag' && NEUTRALS.includes(p.colour) },
  { key: 'basic-dress', title: 'A simple dark dress', category: 'Dress', colour: 'Navy', dressCodes: [2, 4, 5], styles: ['Elegant', 'Classic'], has: (p) => p.category === 'Dress' && ['Black', 'Navy'].includes(p.colour) && p.dressCodes.some((l) => l >= 4) },
];
const GROUP_TO_CATEGORY = { 'Tops & dresses': 'Dress', 'Bottoms & layers': 'Bottom', Shoes: 'Shoes' };
const NOUN = { Top: 'top', Dress: 'dress', Bottom: 'bottom', Layer: 'layer', Shoes: 'shoes', Bag: 'bag', Extra: 'accessory' };

// How many new rule-perfect outfits a hypothetical piece makes possible with what the user owns.
// v1.5: every piece the user OWNS counts (a piece in the laundry is still part of the wardrobe), so a
// full laundry basket never makes a purchase look more useful than it is. Pieces being donated do not count.
function outfitsWith(pieces, hyp, { level, prefs }) {
  const available = pieces.filter((p) => !p.rehome).map((p) => ({ ...p, status: 'Available' }));
  const pool = engine.filterPieces([...available, hyp], { level, prefs: { ...prefs, repeatDays: 0 } });
  if (!pool.some((p) => p.id === hyp.id)) return { count: 0, pairs: [] };
  const combos = engine.combine(pool, { fixedId: hyp.id, cap: 8 }).filter((o) => engine.ruleScore(engine.criteria(o, { level, prefs })) >= 83);
  const partners = new Map();
  for (const o of combos) for (const p of o) if (p.id !== hyp.id) partners.set(p.id, (partners.get(p.id) || 0) + 1);
  const pairs = [...partners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  // v1.5: count distinct outfits (sets of major garments), not every accessory variation.
  const distinct = new Set(combos.map((o) => o.filter((p) => p.id === hyp.id || engine.MAJOR_CATS.includes(p.category)).map((p) => p.id).sort().join('|')));
  return { count: distinct.size, pairs };
}
const hypothetical = (category, colour, dressCodes, styles) => ({
  id: 'hypothetical', category, colour, fabric: 'Cotton', season: 'All seasons', styles: styles || [], dressCodes, modest: true, status: 'Available', wearCount: 0, lastWornAt: null,
});
const similarTo = (pieces, category, colour) => pieces.filter((p) => p.category === category && p.colour === colour);

// Duplicate purchase warning (US-65): how similar an owned piece is to the one the user wants to buy.
// Same category is required. Points: colour 35 (same) or 15 (both neutral) · category 25 ·
// style 15 × shared styles ÷ all styles · formality 15 × shared levels ÷ all levels · season 10 (same or all-season).
// 70 or more = "similar" (a potential duplicate).
const SIMILAR_AT = 70;
// v1.5: the garment type inside a category (skirt ≠ trousers, loafers ≠ boots), read from the name.
const SUBTYPES = [/skirt/, /jean/, /trouser|pant|chino/, /short/, /sneaker|trainer/, /loafer/, /heel|pump/, /boot/, /sandal/, /flat/, /blazer/, /trench|coat/, /cardigan/, /jacket/, /dress/, /tee|t-shirt/, /shirt|blouse/, /sweater|knit|jumper/, /cami/];
const subtypeOf = (p) => { const n = String(p.name || p.word || '').toLowerCase(); const i = SUBTYPES.findIndex((re) => re.test(n)); return i < 0 ? null : i; };
function similarity(owned, want) {
  if (owned.category !== want.category) return { score: 0, matched: [] };
  const matched = ['category'];
  let score = 25;
  const a = subtypeOf(owned); const b = subtypeOf(want);
  if (a !== null && b !== null && a !== b) score -= 20; else if (a !== null && a === b) matched.push('type');
  if (owned.colour === want.colour) { score += 35; matched.push('colour'); } else if (NEUTRALS.includes(owned.colour) && NEUTRALS.includes(want.colour)) { score += 15; matched.push('neutral colour'); }
  const ws = want.styles || []; const os = owned.styles || [];
  const su = new Set([...ws, ...os]);
  if (su.size) { const shared = ws.filter((x) => os.includes(x)).length; score += Math.round((15 * shared) / su.size); if (shared) matched.push('style'); } else score += 15;
  const wl = want.dressCodes || []; const ol = owned.dressCodes || [];
  const lu = new Set([...wl, ...ol]);
  if (lu.size) { const shared = wl.filter((x) => ol.includes(x)).length; score += Math.round((15 * shared) / lu.size); if (shared) matched.push('formality'); }
  if (!want.season || owned.season === want.season || owned.season === 'All seasons' || want.season === 'All seasons') { score += 10; matched.push('season'); }
  return { score: Math.min(100, score), matched };
}
function similarOwned(pieces, want) {
  return pieces.map((p) => ({ ...p, ...(() => { const r = similarity(p, want); return { similarity: r.score, matched: r.matched }; })() }))
    .filter((p) => p.similarity >= SIMILAR_AT).sort((a, b) => b.similarity - a.similarity);
}

const UUID = /^[0-9a-f-]{36}$/i;
const SOURCE_LABEL = { ask: 'Added by Ask Closet', replacement: 'Replacement', gap: 'Wardrobe gap', suggestion: 'Smart suggestion', manual: 'Added by you' };
// What the user wants to buy, as the similarity score sees it: their styles and the levels around their usual dress code.
const wantFor = (prefs, category, colour, level, styles) => {
  const lvl = level || prefs.dressCode || 1;
  return { category, colour, styles: styles && styles.length ? styles : (prefs.styles || []), dressCodes: [...new Set([lvl, Math.max(1, lvl - 1), Math.min(5, lvl + 1)])] };
};
function listItem(r, pieces, prefs) {
  const similar = r.colour ? similarOwned(pieces, wantFor(prefs, r.category, r.colour)) : [];
  return {
    id: r.id, title: r.title, category: r.category, colour: r.colour, source: r.source, sourceLabel: SOURCE_LABEL[r.source], reason: r.reason,
    replaces: r.replaces || null, tags: [SOURCE_LABEL[r.source], r.replaces && r.source !== 'replacement' ? 'Replacement' : null].filter(Boolean),
    status: r.status, createdAt: r.created_at,
    similarOwned: similar.slice(0, 3).map((p) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour, photoUrl: p.photoUrl, similarity: p.similarity })),
    warning: similar.length && !r.replaces ? `You already own ${similar.length === 1 ? 'a similar piece' : `${similar.length} similar pieces`}.` : null,
  };
}

function shoppingRepository(db) {
  return {
    async decisions(userId) { return (await db.query('SELECT key, state FROM shopping.decisions WHERE user_id = $1', [userId])).rows; },
    async decide(userId, key, state) {
      await db.query(`INSERT INTO shopping.decisions (user_id, key, state) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, key) DO UPDATE SET state = EXCLUDED.state, decided_at = now()`, [userId, key, state]);
    },
    async undecide(userId, key) { await db.query('DELETE FROM shopping.decisions WHERE user_id = $1 AND key = $2', [userId, key]); },
    async listItems(userId) { return (await db.query('SELECT * FROM shopping.list_items WHERE user_id = $1 ORDER BY status = \'bought\', created_at DESC', [userId])).rows; },
    async findOpen(userId, { category, colour, title }) {
      return (await db.query(`SELECT * FROM shopping.list_items WHERE user_id = $1 AND status = 'to_buy' AND category = $2
        AND colour IS NOT DISTINCT FROM $3 AND lower(title) = lower($4)`, [userId, category, colour || null, title])).rows[0] || null;
    },
    async insertItem(userId, i) {
      return (await db.query(`INSERT INTO shopping.list_items (user_id, title, category, colour, source, reason, suggestion_key, replaces)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [userId, i.title, i.category, i.colour || null, i.source, i.reason || null, i.suggestionKey || null, i.replaces || null])).rows[0];
    },
    async setStatus(userId, id, status) { return (await db.query('UPDATE shopping.list_items SET status = $3 WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId, status])).rows[0] || null; },
    async removeItem(userId, id) { return (await db.query('DELETE FROM shopping.list_items WHERE id = $1 AND user_id = $2 RETURNING suggestion_key', [id, userId])).rows[0] || null; },
  };
}

function shoppingService({ db, repo: givenRepo, wardrobe, profile }) {
  const repo = givenRepo || shoppingRepository(db);
  async function decisions(userId) {
    return new Map((await repo.decisions(userId)).map((r) => [r.key, r.state]));
  }
  return {
    async suggestions(userId) {
      const [pieces, prefs, deletions, decided] = await Promise.all([
        wardrobe().allPieces(userId), profile.preferences(userId), wardrobe().deletions(userId), decisions(userId),
      ]);
      const levels = levelsUserDressesFor(prefs);
      const main = levels.includes(prefs.dressCode) ? prefs.dressCode : levels[0] || 1;
      const out = [];
      const add = (s) => {
        if (out.some((o) => o.key === s.key)) return;
        const level = s.dressCodes.includes(main) ? main : s.dressCodes[0];
        const r = outfitsWith(pieces, hypothetical(s.category, s.colour, s.dressCodes, s.styles), { level, prefs });
        out.push({ ...s, level, levelName: DRESS_CODES[level], outfitsUnlocked: r.count, pairsWith: r.pairs.map((id) => pieces.find((p) => p.id === id)), similarOwned: similarTo(pieces, s.category, s.colour), state: decided.get(s.key) || null });
      };
      // Replacements for torn / too-small pieces go straight onto the shopping list (US-33), not here.
      // 1. Real gaps at levels the user dresses for (colour: a neutral the user likes and has not let go of)
      for (const g of (await wardrobe().gaps(userId)).gaps) {
        const category = GROUP_TO_CATEGORY[g.group];
        const colour = [...(prefs.colours || []).filter((c) => NEUTRALS.includes(c)), 'Black', 'Navy', 'Beige'].find((c) => !isAvoided(deletions, { category, colour: c })) || 'Black';
        add({ key: `gap-${g.group}-${g.level}`.toLowerCase().replace(/[^a-z0-9-]/g, ''), source: 'Gap', category, colour, dressCodes: [g.level], styles: prefs.styles,
          title: `${g.levelName} ${category === 'Dress' ? 'dress' : category === 'Bottom' ? 'trousers or skirt' : 'shoes'}`, reason: `You have ${g.count === 0 ? 'no' : 'only one'} ${g.levelName.toLowerCase()} ${category === 'Dress' ? 'dress or top' : category === 'Bottom' ? 'bottom' : 'pair of shoes'}, but your occasions need ${g.levelName.toLowerCase()} looks.`, priority: 2 });
      }
      // 2. Missing basics
      for (const b of BASICS) {
        if (pieces.some(b.has)) continue;
        add({ key: b.key, source: 'Basic', category: b.category, colour: b.colour, dressCodes: b.dressCodes, styles: b.styles, title: b.title, reason: 'A versatile basic your closet does not have yet.', priority: 1 });
      }
      // US-34: nothing that matches a piece the user let go of as "No longer my style"; nothing already on the list.
      // A style the user confirmed moving away from (learned "let-go") is never suggested to buy either.
      const letGo = (s) => (prefs.avoidStyles || []).length > 0 && (s.styles || []).length > 0 && s.styles.every((x) => prefs.avoidStyles.includes(x));
      const list = out.filter((s) => !s.state && s.outfitsUnlocked > 0 && !isAvoided(deletions, s) && !letGo(s))
        .sort((a, b) => b.priority - a.priority || b.outfitsUnlocked - a.outfitsUnlocked);
      return { suggestions: list, decided: [...decided.entries()].map(([key, state]) => ({ key, state })), avoid: deletions.filter((d) => d.reason === 'No longer my style').map((d) => ({ category: d.category, colour: d.colour, name: d.name })) };
    },
    // "I want to buy beige trousers. Do I need them?"
    async check(userId, { category, colour, level, styles, season, name }) {
      const [pieces, prefs, deletions] = await Promise.all([wardrobe().allPieces(userId), profile.preferences(userId), wardrobe().deletions(userId)]);
      const want = { ...wantFor(prefs, category, colour, level, styles), season, name };
      const lvl = level || prefs.dressCode || 1;
      const levelsFor = want.dressCodes;
      const similar = similarOwned(pieces, want);
      const r = outfitsWith(pieces, hypothetical(category, colour, levelsFor, prefs.styles), { level: lvl, prefs });
      const disliked = deletions.find((d) => d.reason === 'No longer my style' && d.category === category && d.colour === colour);
      let verdict; let advice;
      const plural = `${colour.toLowerCase()} ${NOUN[category]}${category === 'Shoes' ? '' : 's'}`;
      const duplicate = similar.length ? { count: similar.length, message: `You already own ${similar.length === 1 ? 'a similar' : `${similar.length} similar`} ${similar.length === 1 ? `${colour.toLowerCase()} ${NOUN[category]}` : plural}.`, basis: ['colour', 'category', 'style', 'formality', 'season'] } : null;
      const twin = similar.find((p) => (p.matched || []).includes('type') && (p.matched || []).includes('colour'));
      if (similar.length >= 2) { verdict = 'Skip'; advice = `You already own ${similar.length} similar ${plural}. Style what you have first.`; }
      else if (twin) { verdict = 'Skip'; advice = `You already own ${twin.name ? `your ${twin.name.toLowerCase()}` : 'one'} — almost the same piece.`; }
      else if (disliked) { verdict = 'Think twice'; advice = `You removed a ${colour.toLowerCase()} ${NOUN[category]} before because it was no longer your style.`; }
      // v1.5: 4+ DISTINCT outfits (accessory variations are no longer counted as new outfits)
      else if (r.count >= 4) { verdict = 'Good buy'; advice = `It would make ${r.count} new complete outfits with pieces you already own.`; }
      else if (r.count > 0) { verdict = 'Optional'; advice = `It only adds ${r.count} new outfit${r.count === 1 ? '' : 's'}. Fine if you love it.`; }
      else { verdict = 'Not yet'; advice = `Nothing you own pairs well with it at ${DRESS_CODES[lvl]}. You would need other pieces too.`; }
      if (similar.length === 1 && verdict !== 'Skip') advice += ` You already have one similar piece.`;
      return { category, colour, level: lvl, levelName: DRESS_CODES[lvl], verdict, advice, duplicate, similarOwned: similar, outfitsUnlocked: r.count, pairsWith: r.pairs.map((id) => pieces.find((p) => p.id === id)) };
    },
    // v1.5 Purchase simulation: what would this piece ADD? Runs the real engine with a hypothetical piece;
    // nothing is saved. Reuses duplicate detection (similarity) and gap confidence.
    async impact(userId, { category, colour, styles, dressCodes, season, fabric, name }) {
      const [pieces, prefs] = await Promise.all([wardrobe().allPieces(userId), profile.preferences(userId)]);
      const owned = pieces.filter((p) => !p.rehome);
      const levels = dressCodes && dressCodes.length ? dressCodes : wantFor(prefs, category, colour || 'Black').dressCodes;
      const similar = colour ? similarOwned(owned, { category, colour, styles: styles || prefs.styles || [], dressCodes: levels, season, name }) : owned.filter((p) => p.category === category && (!name || subtypeOf(p) === null || subtypeOf(p) === subtypeOf({ name })));
      const gaps = closetGaps(owned.map((p) => ({ category: p.category, dressCodes: p.dressCodes })), prefs).gaps.map((g) => ins.gapConfidence(g, owned, prefs));
      const r = ins.purchaseImpact(owned, { category, colour: colour || 'Black', styles, dressCodes: levels, season, fabric, name }, { prefs, similar: colour ? similar : [], gaps });
      const what = `${colour ? `${colour.toLowerCase()} ` : ''}${name || NOUN[category]}`;
      const accessory = ['Bag', 'Extra'].includes(category);
      const sentence = r.twin ? `You already own your ${String(r.twin.name || what).toLowerCase()} — ${what} would be almost the same piece.`
        : r.recommendation === 'Probably unnecessary' ? `You already own ${similar.length} similar pieces, so ${what} would add little.`
          : !r.newCombinations ? `Nothing you own pairs well with ${what} yet.`
            : accessory ? `It would finish ${r.newCombinations} of your outfits — nice to have, not essential.`
              : `This would create ${r.newCombinations} new outfit combination${r.newCombinations === 1 ? '' : 's'} with ${r.compatiblePieces} piece${r.compatiblePieces === 1 ? '' : 's'} you already own.`;
      return { ...r, piece: { category, colour: colour || null, dressCodes: levels }, sentence, similar: similar.slice(0, 4).map((p) => ({ id: p.id, name: p.name, photoUrl: p.photoUrl, similarity: p.similarity })) };
    },
    // ---------- shopping list (US-36) ----------
    async list(userId) {
      const [rows, pieces, prefs] = await Promise.all([repo.listItems(userId), wardrobe().allPieces(userId), profile.preferences(userId)]);
      const items = rows.map((r) => listItem(r, pieces, prefs));
      return { items, toBuy: items.filter((i) => i.status === 'to_buy').length, bought: items.filter((i) => i.status === 'bought').length };
    },
    async addToList(userId, { title, category, colour, source = 'manual', reason, suggestionKey, replaces }) {
      const [pieces, prefs, deletions] = await Promise.all([wardrobe().allPieces(userId), profile.preferences(userId), wardrobe().deletions(userId)]);
      const same = await repo.findOpen(userId, { category, colour, title });
      if (same) return { item: listItem(same, pieces, prefs), added: false };
      const row = await repo.insertItem(userId, { title, category, colour, source, reason, suggestionKey, replaces });
      if (suggestionKey) await this.decide(userId, suggestionKey, 'saved');
      const item = listItem(row, pieces, prefs);
      const letGo = colour && isAvoided(deletions, { category, colour });
      return { item, added: true, note: letGo ? `You let go of a ${colour.toLowerCase()} ${NOUN[category]} before because it was no longer your style.` : null };
    },
    async setListStatus(userId, id, status) {
      if (!UUID.test(id)) throw errors.notFound('Shopping list item');
      const row = await repo.setStatus(userId, id, status);
      if (!row) throw errors.notFound('Shopping list item');
      return listItem(row, [], {});
    },
    async removeFromList(userId, id) {
      if (!UUID.test(id)) throw errors.notFound('Shopping list item');
      const row = await repo.removeItem(userId, id);
      if (!row) throw errors.notFound('Shopping list item');
      if (row.suggestion_key) await this.undecide(userId, row.suggestion_key);
      return { removed: true };
    },
    // ItemDeleted (Observer): Torn / damaged or Became too small → replacement on the list (US-33).
    // No longer my style and Other → nothing (US-34).
    async onDeleted(userId, deletion) {
      const r = replacementFor(deletion);
      if (!r) return null;
      return (await this.addToList(userId, r)).item;
    },
    async decide(userId, key, state) {
      await repo.decide(userId, key, state);
      return { key, state };
    },
    async undecide(userId, key) {
      await repo.undecide(userId, key);
      return { key, state: null };
    },
  };
}

function registerShopping(deps) {
  const service = shoppingService(deps);
  if (deps.bus) deps.bus.subscribe(TOPICS.ItemDeleted, async ({ userId, deletion }, ctx) => {
    const listItem = await service.onDeleted(userId, deletion);
    if (ctx && ctx.reactions) ctx.reactions.push({ listItem });
  });
  const r = express.Router();
  // Shopping list (US-36)
  r.get('/list', async (req, res, next) => {
    try { res.json(await service.list(req.user.id)); } catch (e) { next(e); }
  });
  r.post('/list', v.body({
    title: { type: 'string', required: true, min: 1, max: 80, label: 'Title' },
    category: { type: 'enum', values: CATEGORIES, required: true, label: 'Category' },
    colour: { type: 'enum', values: COLOURS },
    source: { type: 'enum', values: ['manual', 'gap', 'suggestion'] },
    reason: { type: 'string', max: 200 },
    suggestionKey: { type: 'string', max: 80 },
  }), async (req, res, next) => {
    try { const r2 = await service.addToList(req.user.id, req.valid); res.status(r2.added ? 201 : 200).json(r2); } catch (e) { next(e); }
  });
  r.patch('/list/:id', v.body({ status: { type: 'enum', values: ['to_buy', 'bought'], required: true } }), async (req, res, next) => {
    try { res.json(await service.setListStatus(req.user.id, req.params.id, req.valid.status)); } catch (e) { next(e); }
  });
  r.delete('/list/:id', async (req, res, next) => {
    try { res.json(await service.removeFromList(req.user.id, req.params.id)); } catch (e) { next(e); }
  });
  r.get('/', async (req, res, next) => {
    try { res.json(await service.suggestions(req.user.id)); } catch (e) { next(e); }
  });
  r.post('/check', v.body({
    category: { type: 'enum', values: CATEGORIES, required: true, label: 'Category' },
    colour: { type: 'enum', values: COLOURS, required: true, label: 'Colour' },
    level: { type: 'int', min: 1, max: 5 },
    styles: { type: 'enumArray', values: STYLES, max: 4 },
    season: { type: 'enum', values: SEASONS },
  }), async (req, res, next) => {
    try { res.json(await service.check(req.user.id, req.valid)); } catch (e) { next(e); }
  });
  r.post('/impact', v.body({
    category: { type: 'enum', values: CATEGORIES, required: true, label: 'Category' },
    colour: { type: 'enum', values: COLOURS },
    styles: { type: 'enumArray', values: STYLES, max: 4 },
    dressCodes: { type: 'enumArray', values: [1, 2, 3, 4, 5], max: 5 },
    season: { type: 'enum', values: SEASONS },
    name: { type: 'string', max: 40 },
  }), async (req, res, next) => {
    try { res.json(await service.impact(req.user.id, req.valid)); } catch (e) { next(e); }
  });
  const KEY = /^[a-z0-9-]{3,80}$/;
  r.put('/:key', v.body({ state: { type: 'enum', values: ['saved', 'dismissed', 'bought'], required: true } }), async (req, res, next) => {
    try {
      if (!KEY.test(req.params.key)) throw errors.notFound('Suggestion');
      return res.json(await service.decide(req.user.id, req.params.key, req.valid.state));
    } catch (e) { return next(e); }
  });
  r.delete('/:key', async (req, res, next) => {
    try { res.json(await service.undecide(req.user.id, String(req.params.key).slice(0, 80))); } catch (e) { next(e); }
  });
  return { service, routes: r };
}

module.exports = { shoppingService, shoppingRepository, registerShopping, outfitsWith, BASICS, similarity, similarOwned, SIMILAR_AT };
