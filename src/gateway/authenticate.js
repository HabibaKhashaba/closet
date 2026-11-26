// Step 3 of the API pipeline: every protected route needs a valid login token.
// It uses Identity & Auth through the IAuthToken interface (verifySession).
const { errors } = require('../shared/errors');

function authenticate(identity) {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw errors.unauthorized();
      req.user = await identity.verifySession(token); // { id, email, role }
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { authenticate };
