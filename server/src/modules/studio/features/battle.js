// Stylist battle was removed in v3.1 (scope change, US-127). Kept only as an empty feature so older module lists still load; it adds no routes.
module.exports = function battleRemoved() { return { methods: {}, routes: [] }; };
