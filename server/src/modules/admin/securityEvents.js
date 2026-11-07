// Account-level events an admin may see in the security log (US-84). Wardrobe actions — pieces,
// outfits, laundry, piece names — are never shown to an admin (NFR-03).
const SECURITY_ACTIONS = ['Account created', 'Signed in', 'Signed in with Google', 'Signed out', 'Profile updated',
  'Admin: account suspended', 'Admin: account restored', 'Admin: account unlocked'];
const SHOW_DETAIL = new Set(['Admin: account suspended', 'Admin: account restored', 'Admin: account unlocked']);
module.exports = { SECURITY_ACTIONS, SHOW_DETAIL };
