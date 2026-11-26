// Privacy & Settings: delete my account and all my photos and data (US-06, NFR-05 / PDPL).
// Double confirmation: the app asks twice, and the request must carry the exact phrase
// (plus the password for email accounts).
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { TOPICS } = require('../../events/eventBus');

const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

function privacyService({ bus, identity }) {
  return {
    async deleteAccount(userId, { confirm, password }) {
      if (confirm !== CONFIRM_PHRASE) {
        throw errors.validation([{ field: 'confirm', message: `Type ${CONFIRM_PHRASE} to confirm` }]);
      }
      await identity.confirmPassword(userId, password);
      // 1. Every module reacts (Wardrobe deletes the photo files).
      await bus.publish(TOPICS.AccountDeleted, { userId });
      // 2. Deleting the user removes every row in every schema (ON DELETE CASCADE).
      await identity.deleteUser(userId);
    },
  };
}

function registerPrivacy({ bus, identity }) {
  const service = privacyService({ bus, identity });
  const r = express.Router();
  r.delete('/', v.body({ confirm: { type: 'string', required: true, max: 40 }, password: { type: 'string', max: 72 } }),
    async (req, res, next) => {
      try { await service.deleteAccount(req.user.id, req.valid); res.status(204).end(); } catch (e) { next(e); }
    });
  return { service, routes: r };
}

module.exports = { registerPrivacy, CONFIRM_PHRASE };
