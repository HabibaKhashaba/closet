// Audit step of the API Gateway (Interceptor): after a successful request, records what the
// user did in the activity log (US-93). Only actions listed in RULES are recorded; reads never are.
// The piece name is looked up before the handler runs, so a deleted piece is still named.
const STATUS_ACTION = { Laundry: 'Moved to Laundry', Packed: 'Marked Packed', Borrowed: 'Lent out', Available: 'Marked Available', Unavailable: 'Marked Unavailable', 'Needs repair': 'Needs repair', 'Needs alteration': 'Needs alteration', 'At tailor': 'Sent to the tailor', 'Ready to donate': 'Ready to donate' };

const RULES = [
  { method: 'POST', path: /^\/register$/, action: 'Account created' },
  { method: 'POST', path: /^\/login$/, action: 'Signed in' },
  { method: 'POST', path: /^\/google$/, action: 'Signed in with Google' },
  { method: 'POST', path: /^\/logout$/, action: 'Signed out' },
  { method: 'PUT', path: /^\/profile(\/quiz)?$/, action: 'Profile updated' },
  { method: 'POST', path: /^\/items$/, action: 'Piece added', detail: (req) => (req.body && req.body.details ? safeName(req.body.details) : null) },
  { method: 'PATCH', path: /^\/items\/([0-9a-f-]{36})$/i, action: 'Piece edited', piece: true },
  { method: 'DELETE', path: /^\/items\/([0-9a-f-]{36})$/i, action: 'Piece deleted', piece: true, detail: (req) => req.body && req.body.reason },
  { method: 'PATCH', path: /^\/items\/([0-9a-f-]{36})\/status$/i, action: (req) => STATUS_ACTION[req.body && req.body.status] || 'Status changed', piece: true, detail: (req) => req.body && req.body.note },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/care$/i, action: (req) => (req.body && req.body.kind === 'alteration' ? 'Needs alteration' : 'Needs repair'), piece: true, detail: (req) => req.body && req.body.reason },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/care\/tailor$/i, action: 'Sent to the tailor', piece: true, detail: (req) => req.body && req.body.tailor },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/care\/done$/i, action: 'Back from care', piece: true },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/lend$/i, action: 'Lent out', piece: true, detail: (req) => req.body && req.body.person },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/return$/i, action: 'Returned', piece: true },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/donate$/i, action: 'Ready to donate', piece: true },
  { method: 'DELETE', path: /^\/items\/([0-9a-f-]{36})\/donate$/i, action: 'Donation cancelled', piece: true },
  { method: 'POST', path: /^\/items\/([0-9a-f-]{36})\/donate\/done$/i, action: 'Donated', piece: true },
  { method: 'POST', path: /^\/laundry\/wash-done$/, action: 'Wash done', detail: (_req, body) => body && `${body.returned} piece${body.returned === 1 ? '' : 's'}` },
  { method: 'POST', path: /^\/outfits\/wear$/, action: 'Outfit worn' },
  { method: 'POST', path: /^\/events$/, action: 'Event added', detail: (req) => req.body && req.body.title },
  { method: 'POST', path: /^\/events\/import$/, action: 'Calendar imported', detail: (_req, body) => body && `${body.imported} events` },
  { method: 'PUT', path: /^\/events\/[0-9a-f-]{36}\/outfit$/i, action: 'Outfit planned' },
  { method: 'POST', path: /^\/packing\/trips\/[0-9a-f-]{36}\/pack$/i, action: 'Packed for a trip', detail: (_req, body) => body && body.trip && `${body.packed} pieces · ${body.trip.destination}` },
  { method: 'POST', path: /^\/intelligence\/learned\/[a-z0-9:-]+$/, action: (req) => (req.body && req.body.decision === 'confirm' ? 'Learned preference confirmed' : 'Learned preference dismissed') },
  { method: 'POST', path: /^\/intelligence\/conflicts\/[0-9a-f-]{36}\/fix$/i, action: 'Planned outfit fixed' },
  { method: 'POST', path: /^\/shopping\/list$/, action: 'Added to shopping list', detail: (req) => req.body && req.body.title },
  { method: 'PATCH', path: /^\/shopping\/list\/[0-9a-f-]{36}$/i, action: (req) => (req.body && req.body.status === 'bought' ? 'Shopping list: bought' : 'Shopping list: back to buy') },
  { method: 'PATCH', path: /^\/admin\/users\/[0-9a-f-]{36}$/i, action: (req) => (req.body && req.body.status === 'suspended' ? 'Admin: account suspended' : 'Admin: account restored'), detail: (_req, body) => body && body.email },
];

function safeName(details) {
  try { const d = typeof details === 'string' ? JSON.parse(details) : details; return d && d.name ? String(d.name) : null; } catch { return null; }
}

function audit(activity) {
  return async (req, res, next) => {
    const rule = RULES.find((r) => r.method === req.method && r.path.test(req.path));
    if (!rule) return next();
    let piece = null;
    if (rule.piece && req.user) {
      try { piece = await activity.pieceName(req.user.id, req.path.match(rule.path)[1]); } catch { piece = null; }
    }
    let body;
    const json = res.json.bind(res);
    res.json = (b) => { body = b; return json(b); };
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const userId = (req.user && req.user.id) || (body && body.user && body.user.id);
      if (!userId) return;
      const action = typeof rule.action === 'function' ? rule.action(req, body) : rule.action;
      const extra = rule.detail ? rule.detail(req, body) : null;
      const detail = [piece, extra].filter(Boolean).join(' · ') || null;
      activity.record(userId, action, detail).catch(() => {}); // auditing never breaks a request
    });
    return next();
  };
}

module.exports = { audit, RULES };
