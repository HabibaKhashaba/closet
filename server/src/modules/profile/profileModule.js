// Accounts & Profile: style quiz (US-02), dress code and modest option (US-03), city (US-04).
// Provides IPreferences, which the Recommendation Engine will read in Sprint 2.
const express = require('express');
const v = require('../../shared/validate');
const { errors } = require('../../shared/errors');
const { STYLES, COLOURS, OCCASIONS } = require('../../shared/vocabulary');
const { TOPICS } = require('../../events/eventBus');

const profileSchema = {
  styles: { type: 'enumArray', values: STYLES, max: STYLES.length },
  colours: { type: 'enumArray', values: COLOURS, max: COLOURS.length },
  occasions: { type: 'enumArray', values: Object.keys(OCCASIONS), max: Object.keys(OCCASIONS).length },
  dressCode: { type: 'int', min: 1, max: 5 },
  modest: { type: 'bool' },
  city: { type: 'string', min: 2, max: 60 },
};
// Settings (version 1.2): laundry basket time, recycle time, laundry day, reminders.
const settingsSchema = {
  ...profileSchema,
  displayName: { type: 'string', min: 1, max: 40, label: 'Name' },
  laundryDays: { type: 'int', min: 1, max: 14, label: 'Laundry time' },
  laundryAutoReturn: { type: 'bool' },
  laundryWeekday: { type: 'int', min: 0, max: 6 },
  repeatDays: { type: 'int', min: 0, max: 30, label: 'Recycle time' },
  reminders: { type: 'bool' },
  reminderHour: { type: 'int', min: 0, max: 23 },
  avoidStyles: { type: 'enumArray', values: STYLES, max: STYLES.length },
};

function toApi(row) {
  return {
    styles: row.styles,
    colours: row.colours,
    occasions: row.occasions,
    dressCode: row.dress_code,
    modest: row.modest,
    city: row.city,
    quizCompleted: Boolean(row.quiz_completed_at),
    displayName: row.display_name ?? null,
    laundryDays: row.laundry_days ?? 2,
    laundryAutoReturn: row.laundry_auto_return ?? true,
    laundryWeekday: row.laundry_weekday ?? null,
    repeatDays: row.repeat_days ?? 3,
    reminders: row.reminders ?? true,
    reminderHour: row.reminder_hour ?? 20,
    avoidStyles: row.avoid_styles || [], // learned from “No longer my style” (US-34, confirmed by the user)
  };
}

function profileRepository(db) {
  return {
    async createDefault(userId) {
      await db.query('INSERT INTO profile.profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    },
    async get(userId) {
      const { rows } = await db.query('SELECT * FROM profile.profiles WHERE user_id = $1', [userId]);
      return rows[0] || null;
    },
    async update(userId, p, completeQuiz) {
      const { rows } = await db.query(
        `UPDATE profile.profiles SET
           styles = COALESCE($2, styles), colours = COALESCE($3, colours), occasions = COALESCE($4, occasions),
           dress_code = COALESCE($5, dress_code), modest = COALESCE($6, modest),
           city = CASE WHEN $7::boolean THEN $8 ELSE city END,
           quiz_completed_at = CASE WHEN $9::boolean THEN COALESCE(quiz_completed_at, now()) ELSE quiz_completed_at END,
           display_name = COALESCE($10, display_name), laundry_days = COALESCE($11, laundry_days),
           laundry_auto_return = COALESCE($12, laundry_auto_return),
           laundry_weekday = CASE WHEN $13::boolean THEN $14 ELSE laundry_weekday END,
           repeat_days = COALESCE($15, repeat_days), reminders = COALESCE($16, reminders), reminder_hour = COALESCE($17, reminder_hour),
           avoid_styles = COALESCE($18, avoid_styles),
           updated_at = now()
         WHERE user_id = $1 RETURNING *`,
        [userId, p.styles ?? null, p.colours ?? null, p.occasions ?? null, p.dressCode ?? null,
          p.modest ?? null, 'city' in p, p.city ?? null, completeQuiz,
          p.displayName ?? null, p.laundryDays ?? null, p.laundryAutoReturn ?? null, 'laundryWeekday' in p, p.laundryWeekday ?? null,
          p.repeatDays ?? null, p.reminders ?? null, p.reminderHour ?? null, p.avoidStyles ?? null],
      );
      return rows[0];
    },
  };
}

function profileService({ repo }) {
  return {
    async get(userId) {
      const row = await repo.get(userId);
      if (!row) throw errors.notFound('Profile');
      return toApi(row);
    },
    // US-02: the quiz may be skipped; skipping still marks it as done so it is not shown again.
    async saveQuiz(userId, answers) {
      return toApi(await repo.update(userId, answers, true));
    },
    async update(userId, changes) {
      return toApi(await repo.update(userId, changes, false));
    },
    // IPreferences (for Sprint 2): raw preferences for the recommendation engine.
    async preferences(userId) {
      return this.get(userId);
    },
  };
}

function profileRoutes({ profile }) {
  const r = express.Router();
  r.get('/', async (req, res, next) => {
    try { res.json(await profile.get(req.user.id)); } catch (e) { next(e); }
  });
  r.put('/quiz', v.body(profileSchema), async (req, res, next) => {
    try { res.json(await profile.saveQuiz(req.user.id, req.valid)); } catch (e) { next(e); }
  });
  r.put('/', v.body(settingsSchema), async (req, res, next) => {
    try {
      // An empty city in settings means "clear my city"; null laundry day means "no fixed day".
      if (req.body.city === '' || req.body.city === null) req.valid.city = null;
      if (req.body.laundryWeekday === null) req.valid.laundryWeekday = null;
      res.json(await profile.update(req.user.id, req.valid));
    } catch (e) { next(e); }
  });
  return r;
}

function registerProfile({ db, bus }) {
  const repo = profileRepository(db);
  const service = profileService({ repo });
  bus.subscribe(TOPICS.UserRegistered, ({ userId }) => repo.createDefault(userId));
  return { service, routes: profileRoutes({ profile: service }) };
}

module.exports = { registerProfile, profileService, profileSchema, settingsSchema, toApi };
