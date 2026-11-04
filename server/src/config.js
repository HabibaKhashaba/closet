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
  // US-118 Virtual Try-On (image-based, one garment). Provider: TRYON_PROVIDER=fashn|mock|none; FASHN_API_KEY.
  tryOn: {
    dailyLimit: Number(process.env.TRYON_DAILY_LIMIT || 20),
    maxActive: 2,                                                  // generations running at once per user
    timeoutMs: Number(process.env.TRYON_TIMEOUT_MS || 180000),     // a job still running after this → FAILED
    minCheckMs: 2500,                                              // at most one provider status call per try-on per 2.5 s
    maxPhotoBytes: 10 * 1024 * 1024,
    maxResultBytes: 15 * 1024 * 1024,
    minPhotoSide: 300,                                             // px, user photo
    minGarmentSide: 200,                                           // px, garment photo
    categories: require('./modules/tryon/imageChecks').supportedCategories(),
  },
};
