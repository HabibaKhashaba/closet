// callClaudeJSON (v3.0 foundation): every language-model call of the v3.0 features goes through here.
// Strict JSON through a tool schema → validated → every garment id checked against the ALLOWED set
// (the user's own Available pieces, or explicitly shared friend pieces). One retry on invalid output,
// then null, so the caller shows a friendly fallback. The model never sees or returns other users' data.
function checkSchema(value, schema, path = '') {
  if (!schema) return [];
  const errs = [];
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path || 'root'} must be an object`];
    for (const k of schema.required || []) if (value[k] === undefined || value[k] === null) errs.push(`${path}${k} is required`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (value[k] !== undefined && value[k] !== null) errs.push(...checkSchema(value[k], s, `${path}${k}.`));
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be a list`];
    if (schema.maxItems && value.length > schema.maxItems) errs.push(`${path} has too many items`);
    value.forEach((x, i) => errs.push(...checkSchema(x, schema.items, `${path}${i}.`)));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') errs.push(`${path} must be text`);
    else if (schema.enum && !schema.enum.includes(value)) errs.push(`${path} is not an allowed value`);
  } else if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) errs.push(`${path} must be a number`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') errs.push(`${path} must be true or false`);
  return errs;
}

// collect every value under a key named like an id list ("itemIds", "garmentIds", "id"…)
function idsIn(value, keys) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (keys.includes(k)) (Array.isArray(x) ? x : [x]).forEach((id) => out.push(id)); else walk(x); }
  };
  walk(value);
  return out;
}

async function callClaudeJSON(llm, { system, content, schema, name = 'answer', description = 'Answer in the required structure.', allowedIds = null, idKeys = ['itemIds', 'garmentIds', 'pieceId', 'garmentId', 'itemId', 'affectedGarmentIds'], maxTokens = 700, validate = null }) {
  if (!llm || !llm.enabled) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await llm.tool(system, content, { name, description, schema }, maxTokens);
      if (checkSchema(out, schema).length) continue;
      if (allowedIds) {
        const ok = new Set(allowedIds);
        if (idsIn(out, idKeys).some((id) => id !== null && id !== '' && !ok.has(id))) continue; // an invented or forbidden piece → retry
      }
      if (validate && !validate(out)) continue;
      return out;
    } catch { /* retry once, then fall back */ }
  }
  return null;
}

module.exports = { callClaudeJSON, checkSchema, idsIn };
