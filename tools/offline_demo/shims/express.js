// Browser build shim: routes are defined by the shared modules but never served in the offline demo
// (localApi.js answers fetch() directly), so the router only needs to accept route definitions.
function Router() { const r = () => {}; for (const m of ['get', 'post', 'put', 'patch', 'delete', 'use', 'all']) r[m] = () => r; return r; }
function express() { return Router(); }
express.Router = Router; express.json = () => () => {}; express.static = () => () => {};
module.exports = express;
