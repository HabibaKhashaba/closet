// All settings come from environment variables, so no secret is ever in the code.
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

function required(name, fallbackForDev) {
  const value = process.env[name];
  if (value) return value;
  if (env === 'production') throw new Error(`Missing environment variable ${name}`);
  return fallbackForDev;
}

module.exports = {
  env,
  port: Number(process.env.PORT || 4000),
  databaseUrl: env === 'test'
    ? required('DATABASE_URL_TEST', 'postgres://postgres:postgres@localhost:5432/closet_test')
    : required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/closet'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  photoUrlSecret: required('PHOTO_URL_SECRET', 'dev-only-photo-secret'),
  photoDir: process.env.PHOTO_DIR || './uploads',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  maxPhotoBytes: 10 * 1024 * 1024, // US-08: photos up to 10 MB
  lockout: { maxFailures: 5, minutes: 15 }, // NFR-04
};
