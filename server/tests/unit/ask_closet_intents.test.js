// Ask Closet intent coverage (Milestone 2 fix D-09: different chats used to get the same beige-trousers answer).
// Equivalence partitioning over the wardrobe domain: every message must route to the function that
// owns that question — and different questions must route to different functions.
const { parse } = require('../../src/modules/assistant/keywordParser');

const NOW = new Date('2026-10-28T10:00:00'); // a Wednesday
describe('AI-40 56 natural-language wardrobe questions route to the right function', () => {
  test.each([
    ['What should I wear to university tomorrow?', 'recommend'],
    ['What can I wear to uni tomorrow?', 'recommend'],
    ['What should I wear to dinner?', 'recommend'],
    ['Style my navy blazer.', 'style_piece'],
    ['What haven\'t I worn lately?', 'forgotten'],
    ['Put my light wash jeans in the laundry.', 'set_status'],
    ['Put the blazer in the wash.', 'set_status'],
    ['Are my black loafers available?', 'availability'],
    ['Is my blazer clean?', 'availability'],
    ['Do I own something like a black blazer?', 'similar_owned'],
    ['What is missing from my wardrobe?', 'closet_needs'],
    ['Should I buy white sneakers?', 'buy_check'],
    ['Do I need beige trousers?', 'buy_check'],
    ['Add this to my shopping list.', 'add_to_shopping'],
    ['What is the weather tomorrow?', 'weather'],
    ['Laundry is done.', 'wash_done'],
    ['Show me pieces I forgot about.', 'forgotten'],
    ['What should I donate?', 'donate_candidates'],
    ['What clothes could I give away?', 'donate_candidates'],
    ['Keep the denim jacket.', 'keep_piece'],
    ['I want to keep it.', 'keep_piece'],
    ['Mark the denim jacket for donation.', 'rehome_piece'],
    ['I donated the denim jacket.', 'rehome_done'],
    ['Pack me for 5 days in Paris.', 'trip_pack'],
    ['What should I bring to Milan next week?', 'trip_pack'],
    ['Can I do this trip with a carry-on?', 'trip_pack'],
    ['Do I need to do laundry before Monday?', 'laundry_risk'],
    ['Which clothes do I need to wash?', 'laundry_list'],
    ['Can you plan my outfits for the next 4 days?', 'week_plan'],
    ['What did I wear to Salma\'s birthday?', 'memory'],
    ['What outfits did I like most?', 'memory'],
    ['Can I repeat yesterday\'s outfit?', 'repeat_check'],
    ['Why is my wardrobe health low?', 'health'],
    ['What clothes should I pack away?', 'seasonal'],
    ['What should I bring back for summer?', 'seasonal'],
    ['Which clothes are out of season?', 'seasonal'],
    ['Who has my blazer?', 'borrowed'],
    ['What clothes have I lent out?', 'borrowed'],
    ['Mark the blazer returned.', 'set_status'],
    ['Is tomorrow\'s outfit still okay for the weather?', 'plan_check'],
    ['I have a wedding tomorrow.', 'event_rescue'],
    ['I have an interview in 2 hours.', 'event_rescue'],
    ['I need something for dinner tonight.', 'event_rescue'],
    ['I have a wedding tomorrow and nothing to wear.', 'event_rescue'],
    ['What would these loafers add to my wardrobe?', 'buy_check'],
    ['Would this blazer be useful?', 'buy_check'],
    ['How many outfits could I make with a white skirt?', 'buy_check'],
    ['What has the best cost per wear?', 'value'],
    ['Was my blazer worth it?', 'value'],
    ['What are my best-value clothes?', 'value'],
    ['What was my least-used expensive purchase?', 'value'],
    ['Do I actually need loafers?', 'buy_check'],
    ['Tell me a joke', 'help'],
    ['What can you do?', 'help'],
    ['Give me something similar to what I wore last Friday.', 'memory'],
    ['Should I buy black trousers?', 'buy_check'],
  ])('“%s” → %s', (msg, fn) => expect(parse(msg, NOW).fn).toBe(fn));
});

describe('Arguments that make the answer specific', () => {
  test('AI-41 “uni” is University; “tomorrow” is a date', () => {
    expect(parse('What can I wear to uni tomorrow?', NOW).args).toMatchObject({ occasion: 'University', date: '2026-10-29' });
  });
  test('AI-42 a garment word narrows the piece (“the blazer” is not every layer)', () => {
    expect(parse('Put the blazer in the wash.', NOW).args).toEqual({ piece: { category: 'Layer', name: 'blazer' }, status: 'Laundry' });
  });
  test('AI-43 availability questions never change state (they are not set_status)', () => {
    for (const q of ['Is my blazer clean?', 'Are my black loafers available?', 'Where is my navy blazer?']) expect(parse(q, NOW).fn).toBe('availability');
  });
  test('AI-44 “this / it” follow-ups ask for the conversation context', () => {
    expect(parse('Add this to my shopping list.', NOW).args.useContext).toBe(true);
    expect(parse('I want to keep it.', NOW).args.useContext).toBe(true);
  });
  test('AI-45 trips: destination, length and carry-on are read', () => {
    expect(parse('Pack me for 5 days in Paris.', NOW).args).toMatchObject({ destination: 'Paris', days: 5 });
    expect(parse('Can I do this trip with a carry-on?', NOW).args.carryOn).toBe(true);
  });
  test('AI-46 outside the wardrobe domain → a scoped answer, not a random outfit', () => {
    expect(parse('Tell me a joke', NOW)).toEqual({ fn: 'help', args: { outOfScope: true } });
    expect(parse('What is the capital of France?', NOW).fn).toBe('help');
  });
  test('AI-47 beige-trouser analysis only when beige trousers are asked about', () => {
    const fns = ['What should I wear to dinner?', 'Is my blazer clean?', 'What should I donate?', 'Who has my blazer?'].map((q) => parse(q, NOW));
    expect(fns.every((r) => r.fn !== 'buy_check')).toBe(true);
    expect(parse('Do I need beige trousers?', NOW)).toMatchObject({ fn: 'buy_check', args: { piece: { colour: 'Beige', category: 'Bottom' } } });
  });
});
