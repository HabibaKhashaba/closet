// Passwords are stored only as bcrypt hashes (NFR-04). bcryptjs is pure JavaScript,
// so it installs the same way on Windows, macOS and Linux.
const bcrypt = require('bcryptjs');

const COST = 10;
const MIN_LENGTH = 8;   // US-01: password at least 8 characters
const MAX_LENGTH = 72;  // bcrypt only uses the first 72 bytes, so longer is refused

function hashPassword(plain) {
  return bcrypt.hash(plain, COST);
}

function checkPassword(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, checkPassword, MIN_LENGTH, MAX_LENGTH };
