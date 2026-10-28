// Item status as a state machine (US-56). Every piece has exactly one status.
// v1.6: the states and moves are the garment lifecycle in shared/lifecycle.js (one source of truth);
// this module keeps its old interface for the modules and tests that use it.
const { ALLOWED, canMove } = require('../../shared/lifecycle');

const INITIAL = 'Available';

module.exports = { ALLOWED, INITIAL, canMove };
