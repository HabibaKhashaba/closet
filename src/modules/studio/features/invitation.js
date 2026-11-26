// Feature 4 — Invitation decoder: a photo or the text of an invitation → an editable event card
// (title, date, time, dress code) → on confirm: a Planner event + looks for that day's weather and dress code.
const { bad, photoOf, levelFromText, occasionFromText, dateFromText, timeFromText, DRESS_CODES, OCCASIONS, OCCASION_FOR_LEVEL } = require('../context');
const { callClaudeJSON } = require('../claudeJson');

const SCHEMA = {
  type: 'object', required: ['title', 'dressCodeLevel'],
  properties: {
    title: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, dressCodeLevel: { type: 'integer' },
    dressCodeText: { type: 'string' }, occasion: { type: 'string', enum: Object.keys(OCCASIONS) }, venue: { type: 'string' }, notes: { type: 'string' },
  },
};

function fromText(text) {
  const level = levelFromText(text) || 2;
  const first = String(text || '').split(/\n|\.|!/).map((s) => s.trim()).find((s) => s.length > 3) || 'Invitation';
  const title = /wedding/i.test(text) ? 'Wedding' : /birthday/i.test(text) ? 'Birthday party' : /engagement/i.test(text) ? 'Engagement party' : /graduation/i.test(text) ? 'Graduation' : /gala/i.test(text) ? 'Gala' : first.slice(0, 60);
  return { title, date: dateFromText(text), time: timeFromText(text), dressCodeLevel: level, dressCodeText: null, occasion: /wedding/i.test(text) ? 'Wedding' : occasionFromText(text, level), venue: null, notes: null };
}
const cleanDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(new Date(d).getTime()) ? d : null);
const cleanTime = (t) => (/^\d{2}:\d{2}$/.test(t || '') ? t : null);

module.exports = function invitation(deps) {
  const methods = {
    async decode(userId, body = {}) {
      const photo = photoOf(body);
      const text = String(body.text || '').slice(0, 2000);
      if (!photo && !text.trim()) throw bad('text', 'Paste the invitation text or add a photo of it.');
      const today = new Date().toISOString().slice(0, 10);
      const ai = await callClaudeJSON(deps.llm, {
        system: `You read an event invitation. Today is ${today}. Return the event title, the date as YYYY-MM-DD (the next future date if no year), the start time as HH:MM 24h, and the dress code as a level: 1 casual, 2 smart casual, 3 business casual, 4 cocktail / semi-formal, 5 formal / black tie. Copy the dress code words exactly into dressCodeText. Leave a field empty if it is not written.`,
        content: [...(photo ? [{ type: 'image', mime: photo.mime, base64: photo.base64 }] : []), { type: 'text', text: text || 'Read the invitation in the image.' }],
        schema: SCHEMA, name: 'invitation', maxTokens: 300, validate: (o) => o.dressCodeLevel >= 1 && o.dressCodeLevel <= 5,
      });
      if (!ai && !text.trim()) return { source: 'none', card: { title: '', date: null, time: null, dressCodeLevel: 2, dressCodeName: DRESS_CODES[2], occasion: 'Dinner' }, message: 'We could not read the photo. Fill in the details.' };
      const r = ai || fromText(text);
      const level = Math.min(5, Math.max(1, Math.round(r.dressCodeLevel || 2)));
      const card = { title: String(r.title || 'Invitation').slice(0, 80), date: cleanDate(r.date), time: cleanTime(r.time) || '19:00', dressCodeLevel: level, dressCodeName: DRESS_CODES[level],
        dressCodeText: r.dressCodeText || null, occasion: OCCASIONS[r.occasion] ? r.occasion : OCCASION_FOR_LEVEL[level], venue: r.venue || null };
      return { source: ai ? 'ai' : 'keywords', card, message: card.date ? null : 'We could not find a date. Choose it before saving.' };
    },

    async confirm(userId, body = {}) {
      const c = body.card || {};
      if (!cleanDate(c.date)) throw bad('card.date', 'Choose the date.');
      if (!c.title || !String(c.title).trim()) throw bad('card.title', 'Give the event a name.');
      const level = Math.min(5, Math.max(1, Number(c.dressCodeLevel) || 2));
      const occasion = OCCASIONS[c.occasion] ? c.occasion : OCCASION_FOR_LEVEL[level];
      const event = await deps.planner().add(userId, { title: String(c.title).slice(0, 80), date: c.date, time: cleanTime(c.time) || '19:00', occasion, dressCode: level });
      const rec = await deps.rec().recommend(userId, { occasion, level, date: c.date });
      return { event, weather: rec.weather, looks: rec.outfits.slice(0, 3), note: rec.note || rec.availabilityNote || null };
    },
  };
  return { methods, routes: [['POST', '/invitation/decode', (r) => methods.decode(r.userId, r.body)], ['POST', '/invitation/confirm', (r) => methods.confirm(r.userId, r.body)]] };
};
module.exports.fromText = fromText;
