// Turns errors into safe JSON. Unknown errors never reveal stack traces or SQL.
const { AppError } = require('../shared/errors');
const config = require('../config');

// Counted for the Admin system-health view (US-81): unexpected errors since the server started.
const counters = { serverErrors: 0, startedAt: new Date() };

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BAD_JSON', message: 'The request body is not valid JSON.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'The request is too large.' });
  }
  counters.serverErrors += 1;
  if (config.env !== 'test' || process.env.DEBUG_ERRORS) console.error(err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
}

function notFoundRoute(_req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'No such endpoint.' });
}

module.exports = { errorHandler, notFoundRoute, counters };
