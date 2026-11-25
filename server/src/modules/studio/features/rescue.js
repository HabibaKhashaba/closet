// Feature 3 — Emergency rescue: "I spilled coffee on my shirt" → the smallest change that saves the look.
// 1) understand the problem (language model → strict JSON with checked ids; fallback: keywords)
// 2) optionally mark the piece (Laundry / Needs repair) through the normal status flow
// 3) search for the look that changes the FEWEST pieces (1, then 2 …) and still scores ≥ 83.
const C = require('../compatibility');
const { loadContext, brief, bad, categoriesIn, levelFromText, pickOccasion } = require('../context');
const { callClaudeJSON } = require('../claudeJson');

const PROBLEMS = ['stain', 'damage', 'too_formal', 'too_casual', 'too_cold', 'too_hot', 'other'];
const STATUS_FOR = { stain: 'Laundry', damage: 'Needs repair' };

function parseKeywords(text, outfit) {
  const t = String(text || '').toLowerCase();
  const problem = /stain|spill|coffee|dirty|wet|ink|food|mud/.test(t) ? 'stain'
    : /broke|broken|torn|tore|rip|ripped|snapped|heel came|zip|button/.test(t) ? 'damage'
      : /too formal|overdressed|dress(ed)? down|more casual/.test(t) ? 'too_formal'
        : /too casual|underdressed|more formal|fancier|black tie|cocktail|formal/.test(t) ? 'too_casual'
          : /cold|freezing|chilly|rain/.test(t) ? 'too_cold' : /hot|sweating|warm/.test(t) ? 'too_hot' : 'other';
  const cats = categoriesIn(t);
  let affected = outfit.filter((p) => cats.includes(p.category) || (cats.includes('Top') && p.category === 'Dress'));
  if (!affected.length && ['stain', 'damage'].includes(problem)) affected = outfit.filter((p) => ['Top', 'Dress'].includes(p.category)).slice(0, 1);
  return { problem, affectedGarmentIds: affected.map((p) => p.id), newLevel: levelFromText(t) };
}

module.exports = function rescue(deps) {
  const methods = {
    async rescue(userId, body = {}) {
      const ids = body.itemIds;
      const text = String(body.problem || '').slice(0, 300);
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4) throw bad('itemIds', 'Choose the outfit you are wearing (2–4 pieces).');
      if (!text.trim()) throw bad('problem', 'Tell us what happened.');
      const occasion = pickOccasion(body.occasion);
      const ctx = await loadContext(deps, userId, { occasion });
      const outfit = ids.map((id) => ctx.pieces.find((p) => p.id === id));
      if (outfit.some((p) => !p)) throw require('../../../shared/errors').errors.notFound('Piece');
      let parsed = await callClaudeJSON(deps.llm, {
        system: 'You read a short emergency message about an outfit. Return the problem type and the ids of the affected pieces, chosen ONLY from the list given. newLevel is a dress-code level 1-5 only if the user asks for more/less formal, else 0.',
        content: [{ type: 'text', text: JSON.stringify({ message: text, outfit: outfit.map((p) => ({ id: p.id, name: p.name, category: p.category, colour: p.colour })) }) }],
        schema: { type: 'object', required: ['problem', 'affectedGarmentIds'], properties: { problem: { type: 'string', enum: PROBLEMS }, affectedGarmentIds: { type: 'array', maxItems: 4, items: { type: 'string' } }, newLevel: { type: 'integer' } } },
        name: 'rescue_problem', allowedIds: ids, maxTokens: 200,
      });
      const source = parsed ? 'ai' : 'keywords';
      if (!parsed) parsed = parseKeywords(text, outfit);
      const affected = new Set(parsed.affectedGarmentIds);
      let level = C.levelFor({ occasion });
      if (parsed.problem === 'too_formal') level = Math.max(1, (parsed.newLevel > 0 ? parsed.newLevel : level - 1));
      if (parsed.problem === 'too_casual') level = Math.min(5, (parsed.newLevel > 0 ? parsed.newLevel : level + 1));
      if (['too_formal', 'too_casual'].includes(parsed.problem) && !affected.size) outfit.filter((p) => C.MAIN.includes(p.category)).forEach((p) => affected.add(p.id));
      let weather = ctx.weather;
      if (parsed.problem === 'too_cold') weather = { ...(weather || {}), tempC: Math.min(weather ? weather.tempC : 15, 15) };
      if (parsed.problem === 'too_hot') weather = { ...(weather || {}), tempC: Math.max(weather ? weather.tempC : 28, 28) };

      // mark the piece through the normal status flow (only when the user asked us to)
      const marked = [];
      if (body.apply && STATUS_FOR[parsed.problem]) {
        for (const id of affected) { await deps.availability.setStatus(userId, id, STATUS_FOR[parsed.problem], { note: text.slice(0, 120) }); marked.push(id); }
      }
      const pool = ctx.pieces.map((p) => (affected.has(p.id) && STATUS_FOR[parsed.problem] ? { ...p, status: STATUS_FOR[parsed.problem] } : p));
      const c = { level, prefs: ctx.prefs, weather };
      const keep = outfit.filter((p) => !affected.has(p.id));
      // fewest changes: try keeping every unaffected piece, then let one more go at a time
      let best = null;
      for (let drop = 0; drop <= keep.length && !best; drop++) {
        const combos = drop === 0 ? [keep] : subsets(keep, keep.length - drop);
        for (const locked of combos) {
          const looks = C.enumerateOutfits(pool, { ...c, locked: locked.map((p) => p.id), excluded: [...affected], cap: 30 });
          for (const l of looks) {
            const changed = l.pieces.filter((p) => C.MAIN.includes(p.category) && !ids.includes(p.id)).length;
            if (!best || changed < best.changed || (changed === best.changed && l.score > best.look.score)) best = { look: l, changed };
          }
          if (best) break;
        }
      }
      const problemLabel = { stain: 'A stain', damage: 'Something broke', too_formal: 'Too formal', too_casual: 'Too casual', too_cold: 'Too cold', too_hot: 'Too hot', other: 'Something is off' }[parsed.problem];
      if (!best) return { source, problem: parsed.problem, problemLabel, affected: outfit.filter((p) => affected.has(p.id)).map(brief), marked, fix: null, message: 'No quick fix in your available pieces. Try Style me for a fresh look.' };
      const swaps = outfit.filter((p) => !best.look.itemIds.includes(p.id)).map((out) => ({ out: brief(out), in: brief(best.look.pieces.find((p) => p.category === out.category && !ids.includes(p.id)) || null) }));
      return {
        source, problem: parsed.problem, problemLabel, level, affected: outfit.filter((p) => affected.has(p.id)).map(brief), marked,
        fix: { itemIds: best.look.itemIds, pieces: best.look.pieces.map(brief), score: best.look.score, compatibility: best.look.compatibility, reasons: best.look.reasons, changed: best.changed, swaps },
        message: best.changed <= 1 ? 'Change one piece and you are good to go.' : `Change ${best.changed} pieces and you are good to go.`,
      };
    },
  };
  return { methods, routes: [['POST', '/rescue', (r) => methods.rescue(r.userId, r.body)]] };
};

function subsets(list, size) {
  if (size <= 0) return [[]];
  if (size > list.length) return [];
  const out = [];
  const go = (start, acc) => { if (acc.length === size) { out.push(acc); return; } for (let i = start; i < list.length; i++) go(i + 1, [...acc, list[i]]); };
  go(0, []);
  return out;
}
module.exports.parseKeywords = parseKeywords;
