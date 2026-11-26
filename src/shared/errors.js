// Errors the API is allowed to show to the client. Anything else becomes a plain 500.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const errors = {
  validation: (details) => new AppError(400, 'VALIDATION_FAILED', 'Some fields are not valid.', details),
  unauthorized: (message = 'Please sign in.') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'You do not have permission to do this.'),
  // A piece that belongs to someone else returns 404, so we never reveal that it exists.
  notFound: (what = 'Item') => new AppError(404, 'NOT_FOUND', `${what} not found.`),
  conflict: (code, message) => new AppError(409, code, message),
  locked: () => new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.'),
  payloadTooLarge: () => new AppError(413, 'FILE_TOO_LARGE', 'Photos can be up to 10 MB.'),
  unsupportedMedia: () => new AppError(415, 'UNSUPPORTED_FILE', 'Use a JPG, PNG, WebP or HEIC photo.'),
};

module.exports = { AppError, errors };
