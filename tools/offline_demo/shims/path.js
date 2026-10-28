module.exports = { join: (...a) => a.join('/'), extname: (f) => (String(f).match(/\.[^./]+$/) || [''])[0], resolve: (...a) => a.join('/') };
