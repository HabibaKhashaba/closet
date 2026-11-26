// Step 4 of the API pipeline: authorisation.
// 1. Role check: some routes are for admins only (used from Sprint 3, US-80).
// 2. Ownership: every repository query is filtered by req.user.id, so a user can
//    only ever read or change their own rows. Someone else's piece looks "not found".
const { errors } = require('../shared/errors');

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(errors.forbidden());
    return next();
  };
}

module.exports = { requireRole };
