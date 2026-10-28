// Step 1 of the API pipeline (API Gateway): HTTPS, CORS, security headers, rate limits, body size.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');

function httpsOnly(req, res, next) {
  // Hosting platforms end TLS at their proxy and pass the original protocol in this header.
  if (config.env === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  return next();
}

function securityPipeline(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(httpsOnly);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Google sign-in popup
    contentSecurityPolicy: {
      directives: {
        // blob: lets the web app preview a photo before it is uploaded (defect D-03).
        'img-src': ["'self'", 'data:', 'blob:'],
        'script-src': ["'self'", 'https://accounts.google.com'],
        'frame-src': ['https://accounts.google.com'],
        'connect-src': ["'self'", 'https://accounts.google.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  }));
  app.use(cors({ origin: config.clientOrigin, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
  app.use(express.json({ limit: '100kb' }));
  if (config.env !== 'test') {
    // Photo requests are not counted: one closet page loads every photo (defect D-04).
    app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path.startsWith('/v1/photos/'),
    }));
  }
}

// Stricter limit on sign-in and registration, against password guessing.
const authLimiter = config.env === 'test'
  ? (_req, _res, next) => next()
  : rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

module.exports = { securityPipeline, authLimiter, httpsOnly };
