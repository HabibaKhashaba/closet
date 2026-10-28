// Identity & Auth: register, login (with lockout), Google sign-in, logout, session checks.
// Provides IAuthToken (verifySession) to the Authentication step of the API pipeline.
const { errors } = require('../../shared/errors');
const { hashPassword, checkPassword } = require('./passwords');
const { issueToken, readToken } = require('./tokens');
const { TOPICS } = require('../../events/eventBus');
const config = require('../../config');

// One message for unknown email and wrong password, so attackers cannot find valid emails.
const BAD_LOGIN = 'Email or password is incorrect.';

function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role };
}

function identityService({ repo, bus, googleVerifier }) {
  async function startSession(user) {
    return { token: issueToken(user), user: publicUser(user) };
  }

  return {
    async register({ email, password }) {
      if (await repo.findByEmail(email)) throw errors.conflict('EMAIL_TAKEN', 'An account with this email already exists.');
      const user = await repo.create({ email, passwordHash: await hashPassword(password) });
      await bus.publish(TOPICS.UserRegistered, { userId: user.id });
      return startSession(user);
    },

    async login({ email, password }) {
      const user = await repo.findByEmail(email);
      if (!user) throw errors.unauthorized(BAD_LOGIN);
      if (user.locked_until && new Date(user.locked_until) > new Date()) throw errors.locked();
      if (user.locked_until) await repo.resetFailures(user.id); // lock has expired: start counting again
      if (user.account_status !== 'active') throw errors.forbidden();
      if (!(await checkPassword(password, user.password_hash))) {
        const after = await repo.recordFailure(user.id, config.lockout.maxFailures, config.lockout.minutes);
        if (after.failed_logins >= config.lockout.maxFailures) throw errors.locked();
        throw errors.unauthorized(BAD_LOGIN);
      }
      await repo.resetFailures(user.id);
      return startSession(user);
    },

    // Google sign-in: the browser gets an ID token from Google; we check it with Google
    // and then find or create the matching account.
    async loginWithGoogle({ credential }) {
      if (!googleVerifier) throw errors.conflict('GOOGLE_DISABLED', 'Google sign-in is not configured.');
      const google = await googleVerifier(credential); // { sub, email } or null
      if (!google) throw errors.unauthorized('Google sign-in failed.');
      let user = await repo.findByGoogleId(google.sub);
      if (!user) {
        user = await repo.findByEmail(google.email);
        if (user) await repo.linkGoogle(user.id, google.sub);
        else {
          user = await repo.create({ email: google.email, googleId: google.sub });
          await bus.publish(TOPICS.UserRegistered, { userId: user.id });
        }
        user = await repo.findById(user.id);
      }
      if (user.account_status !== 'active') throw errors.forbidden();
      return startSession(user);
    },

    async logout(userId) {
      await repo.bumpTokenVersion(userId);
    },

    // IAuthToken: checks signature, expiry, token version and account status.
    async verifySession(token) {
      const claims = readToken(token);
      if (!claims) throw errors.unauthorized('Your session has expired. Please sign in again.');
      const user = await repo.findById(claims.sub);
      if (!user || user.token_version !== claims.tv || user.account_status !== 'active') {
        throw errors.unauthorized('Your session has expired. Please sign in again.');
      }
      return publicUser(user);
    },

    async confirmPassword(userId, password) {
      const user = await repo.findById(userId);
      if (user && user.password_hash && !(await checkPassword(password || '', user.password_hash))) {
        throw errors.unauthorized('Password is incorrect.');
      }
    },

    async deleteUser(userId) {
      await repo.delete(userId);
    },
  };
}

// Real verifier used in production: asks Google to validate the ID token.
function googleTokenVerifier(clientId) {
  if (!clientId) return null;
  return async (credential) => {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    const info = await res.json();
    if (info.aud !== clientId || info.email_verified !== 'true') return null;
    return { sub: info.sub, email: info.email.toLowerCase() };
  };
}

module.exports = { identityService, googleTokenVerifier, BAD_LOGIN };
