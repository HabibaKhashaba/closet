const express = require('express');
const v = require('../../shared/validate');
const { MIN_LENGTH, MAX_LENGTH } = require('./passwords');
const { authLimiter } = require('../../gateway/security');

const registerSchema = {
  email: { type: 'email', required: true, label: 'Email' },
  password: { type: 'string', required: true, min: MIN_LENGTH, max: MAX_LENGTH, label: 'Password' },
};
const loginSchema = {
  email: { type: 'email', required: true, label: 'Email' },
  password: { type: 'string', required: true, max: MAX_LENGTH, label: 'Password' },
};

function identityRoutes({ identity, auth }) {
  const r = express.Router();
  r.post('/register', authLimiter, v.body(registerSchema), async (req, res, next) => {
    try { res.status(201).json(await identity.register(req.valid)); } catch (e) { next(e); }
  });
  r.post('/login', authLimiter, v.body(loginSchema), async (req, res, next) => {
    try { res.json(await identity.login(req.valid)); } catch (e) { next(e); }
  });
  r.post('/google', authLimiter, v.body({ credential: { type: 'string', required: true, max: 4096 } }), async (req, res, next) => {
    try { res.json(await identity.loginWithGoogle(req.valid)); } catch (e) { next(e); }
  });
  r.post('/logout', auth, async (req, res, next) => {
    try { await identity.logout(req.user.id); res.status(204).end(); } catch (e) { next(e); }
  });
  r.get('/me', auth, (req, res) => res.json({ user: req.user }));
  return r;
}

module.exports = { identityRoutes, registerSchema };
