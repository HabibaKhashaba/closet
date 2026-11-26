// In-process publish/subscribe (Observer pattern).
// The publisher does not know who listens: e.g. Wardrobe publishes ItemCreated and
// Availability reacts by giving the new piece the status Available.
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  subscribe(topic, handler) {
    if (!this.handlers.has(topic)) this.handlers.set(topic, []);
    this.handlers.get(topic).push(handler);
  }

  // Handlers run in order and are awaited, so a request finishes only after
  // every module has reacted (simple and predictable for a single process).
  async publish(topic, payload, context) {
    for (const handler of this.handlers.get(topic) || []) {
      await handler(payload, context);
    }
  }
}

const TOPICS = {
  UserRegistered: 'UserRegistered',
  ItemCreated: 'ItemCreated',
  ItemDeleted: 'ItemDeleted', // { userId, deletion } — Smart Shopping adds a replacement when the reason asks for one
  OutfitWorn: 'OutfitWorn',
  AccountDeleted: 'AccountDeleted',
};

module.exports = { EventBus, TOPICS };
