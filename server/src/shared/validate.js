// Small declarative validator used by the Request Validation step of the API pipeline.
// A schema maps each field to a rule; validate() returns a cleaned object or throws a 400.
const { errors } = require('./errors');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value) {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function checkField(field, rule, value) {
  const name = rule.label || field;
  const missing = value === undefined || value === null || value === '';
  if (missing) return rule.required ? `${name} is required` : null;

  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `${name} must be text`;
      if (rule.min !== undefined && value.trim().length < rule.min) return `${name} must be at least ${rule.min} characters`;
      if (rule.max !== undefined && value.length > rule.max) return `${name} must be at most ${rule.max} characters`;
      return null;
    case 'email':
      // Trim first (defect D-01: " a@b.com " was rejected instead of cleaned).
      return typeof value === 'string' && value.trim().length <= 254 && EMAIL.test(value.trim()) ? null : 'Enter a valid email address';
    case 'enum':
      return rule.values.includes(value) ? null : `${name} must be one of: ${rule.values.join(', ')}`;
    case 'enumArray':
      if (!Array.isArray(value)) return `${name} must be a list`;
      if (rule.min !== undefined && value.length < rule.min) return `${name} needs at least ${rule.min} value`;
      if (rule.max !== undefined && value.length > rule.max) return `${name} can have at most ${rule.max} values`;
      return value.every((v) => rule.values.includes(v)) ? null : `${name} contains a value that is not allowed`;
    case 'int': {
      const n = Number(value);
      if (!Number.isInteger(n)) return `${name} must be a whole number`;
      if (rule.min !== undefined && n < rule.min) return `${name} must be between ${rule.min} and ${rule.max}`;
      if (rule.max !== undefined && n > rule.max) return `${name} must be between ${rule.min} and ${rule.max}`;
      return null;
    }
    case 'number': { // decimals allowed (prices); at most 2 decimal places
      const n = Number(value);
      if (typeof value === 'boolean' || !Number.isFinite(n)) return `${name} must be a number`;
      if (rule.min !== undefined && n < rule.min) return `${name} must be at least ${rule.min}`;
      if (rule.max !== undefined && n > rule.max) return `${name} must be at most ${rule.max}`;
      if (Math.round(n * 100) !== Math.round(n * 100 * 1000) / 1000) return `${name} can have at most 2 decimals`;
      return null;
    }
    case 'bool':
      return typeof value === 'boolean' || value === 'true' || value === 'false' ? null : `${name} must be true or false`;
    case 'date':
      return isRealDate(value) ? null : `${name} must be a real date (YYYY-MM-DD)`;
    case 'time':
      return TIME.test(value) ? null : `${name} must be a time (HH:MM)`;
    default:
      return null;
  }
}

function coerce(rule, value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (rule.type === 'int' || rule.type === 'number') return Number(value);
  if (rule.type === 'bool') return value === true || value === 'true';
  if (rule.type === 'string') return value.trim();
  if (rule.type === 'email') return value.trim().toLowerCase();
  return value;
}

function validate(schema, input = {}) {
  const details = [];
  const clean = {};
  for (const [name, rule] of Object.entries(schema)) {
    const message = checkField(name, rule, input[name]);
    if (message) details.push({ field: name, message });
    else {
      const v = coerce(rule, input[name]);
      if (v !== undefined) clean[name] = v;
    }
  }
  if (details.length) throw errors.validation(details);
  return clean;
}

// Express middleware: validates req.body (or req.query) against a schema.
function body(schema) {
  return (req, _res, next) => {
    try { req.valid = validate(schema, req.body); next(); } catch (e) { next(e); }
  };
}
function query(schema) {
  return (req, _res, next) => {
    try { req.validQuery = validate(schema, req.query); next(); } catch (e) { next(e); }
  };
}

module.exports = { validate, body, query, isRealDate };
