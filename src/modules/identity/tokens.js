// Login tokens are signed JWTs (HS256) that expire after JWT_EXPIRES_IN.
// The token carries the user id, role and token version; logout raises the version,
// so tokens issued before logout stop working.
const jwt = require('jsonwebtoken');
const config = require('../../config');

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.token_version }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
}

// Returns the claims, or null if the token is forged, malformed or expired.
function readToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

module.exports = { issueToken, readToken };
