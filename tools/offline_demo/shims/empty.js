// Browser build shim for the offline demo: server-only packages (HTTP, database, hashing, files) are
// not used in the browser, but their modules are imported by the shared server code. See build.sh.
module.exports = {};
