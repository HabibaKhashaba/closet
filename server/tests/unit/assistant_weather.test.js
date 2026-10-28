// Unit tests: Ask Closet intent parsing (keyword fallback and language-model adapter) and the Weather Adapter.
const { parse, pieceQuery, parseDate } = require('../../src/modules/assistant/keywordParser');
const { llmAdapter, toCall } = require('../../src/modules/assistant/llmAdapter');
const { weatherAdapter, fallback } = require('../../src/modules/recommendation/weatherAdapter');
const { matchPieces } = require('../../src/modules/assistant/assistantModule');

describe('Keyword parser: message → one whitelisted function (EP)', () => {
  test.each([
    ['AI-01', 'What should I wear to dinner tomorrow?', 'recommend'],
    ['AI-02', 'Change the shoes', 'change_piece'],
    ['AI-03', 'Put my blue jeans in the laundry', 'set_status'],
    ['AI-04', 'I lent my red jacket to Salma', 'set_status'],
    ['AI-05', 'Laundry is done', 'wash_done'],
    ['AI-06', 'What haven’t I worn lately?', 'forgotten'],
    ['AI-07', 'What does my closet need?', 'closet_needs'],
    ['AI-08', 'Weather tomorrow?', 'weather'],
    ['AI-09', 'Style my green dress', 'style_piece'],
    ['AI-10', 'Hide my pink jeans for a week', 'hide_piece'],
    ['AI-11', 'Plan my outfit for the wedding', 'plan_event'],
    ['AI-12', 'Tell me a joke', 'help'],
  ])('%s “%s” → %s', (_id, msg, fn) => expect(parse(msg).fn).toBe(fn));

  test('AI-13 occasion, style and slot are extracted', () => {
    expect(parse('A chic outfit for my interview').args).toMatchObject({ occasion: 'Interview', style: 'Chic' });
    expect(parse('swap the top').args.slot).toBe(0);
    expect(parse('I lent my red jacket').args).toEqual({ piece: { colour: 'Red', category: 'Layer' }, status: 'Borrowed' });
  });
  test('AI-14 piece descriptions: synonyms and fabric', () => {
    expect(pieceQuery(' my cream jeans ')).toEqual({ colour: 'Beige', category: 'Bottom', fabric: 'Denim' });
    expect(pieceQuery(' the grey silk top ')).toEqual({ colour: 'Grey', category: 'Top', fabric: 'Silk' });
    expect(pieceQuery(' hello there ')).toBeNull();
  });
  test('AI-15 dates: today, tomorrow, next weekday', () => {
    const sun = new Date('2026-10-25T10:00:00'); // a Sunday
    expect(parseDate(' tomorrow ', sun)).toBe('2026-10-26');
    expect(parseDate(' on friday ', sun)).toBe('2026-10-30');
    expect(parseDate(' on sunday ', sun)).toBe('2026-11-01');
    expect(parseDate(' sometime ', sun)).toBeNull();
  });
  test('AI-16 matching pieces by colour, category and fabric', () => {
    const ps = [{ colour: 'Blue', category: 'Bottom', fabric: 'Denim' }, { colour: 'Blue', category: 'Top', fabric: 'Cotton' }];
    expect(matchPieces(ps, { colour: 'Blue', fabric: 'Denim' })).toHaveLength(1);
    expect(matchPieces(ps, { colour: 'Blue' })).toHaveLength(2);
    expect(matchPieces(ps, null)).toHaveLength(0);
  });
});

describe('Language Model Adapter (IIntentParser)', () => {
  test('AI-17 no API key → keyword parser', async () => {
    const r = await llmAdapter({ env: {} }).interpret('put my blue jeans in the laundry');
    expect(r).toMatchObject({ fn: 'set_status', via: 'keyword parser' });
  });
  test('AI-18 with a key: the model’s tool call is used (only whitelisted functions)', async () => {
    const fetchImpl = async () => ({ json: async () => ({ content: [{ type: 'tool_use', input: { fn: 'recommend', occasion: 'Party', style: 'Bold' } }] }) });
    const r = await llmAdapter({ env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl }).interpret('something fun for tonight');
    expect(r).toMatchObject({ fn: 'recommend', args: { occasion: 'Party', style: 'Bold' }, via: 'anthropic' });
    expect(toCall({ fn: 'drop_database' }).fn).toBe('help');
  });
  test('AI-19 model down → falls back to the keyword parser (NFR-06)', async () => {
    const fetchImpl = async () => { throw new Error('timeout'); };
    const r = await llmAdapter({ env: { OPENAI_API_KEY: 'k' }, fetchImpl }).interpret('laundry is done');
    expect(r).toMatchObject({ fn: 'wash_done', via: 'keyword parser (language model unavailable)' });
  });
});

describe('Weather Adapter (IWeather)', () => {
  const day = new Date().toISOString().slice(0, 10);
  const api = (calls) => async (url) => {
    calls.push(url);
    if (url.includes('geocoding')) return { json: async () => ({ results: [{ name: 'Cairo', latitude: 30, longitude: 31 }] }) };
    return { json: async () => ({ current: { temperature_2m: 27.6 }, daily: { time: [day, '2099-01-01'], temperature_2m_max: [31.2, 20], temperature_2m_min: [21.4, 10], weather_code: [0, 61] } }) };
  };
  test('WA-01 today uses the current temperature; source Open-Meteo', async () => {
    const w = await weatherAdapter({ fetchImpl: api([]) }).forDate('Cairo', day);
    expect(w).toMatchObject({ tempC: 28, high: 31, low: 21, condition: 'Clear', source: 'Open-Meteo', place: 'Cairo' });
  });
  test('WA-02 a later day uses its maximum', async () => {
    expect((await weatherAdapter({ fetchImpl: api([]) }).forDate('Cairo', '2099-01-01'))).toMatchObject({ tempC: 20, condition: 'Rain' });
  });
  test('WA-03 cached for 30 minutes: the second call does not hit the service', async () => {
    const calls = []; let t = 0;
    const w = weatherAdapter({ fetchImpl: api(calls), now: () => t });
    await w.forDate('Cairo', day); await w.forDate('cairo', day);
    expect(calls).toHaveLength(2); // geocode + forecast once
    t = 31 * 60 * 1000; await w.forDate('Cairo', day);
    expect(calls).toHaveLength(4);
  });
  test('WA-04 service down → seasonal estimate, labelled (NFR-06)', async () => {
    const w = await weatherAdapter({ fetchImpl: async () => { throw new Error('down'); } }).forDate('Cairo', '2026-07-15');
    expect(w).toMatchObject({ tempC: 35, source: 'estimate', note: 'Weather service unavailable' });
  });
  test('WA-05 no city, or more than 16 days ahead → estimate', async () => {
    expect((await weatherAdapter({ fetchImpl: api([]) }).forDate(null, '2026-01-10')).note).toBe('No city in your profile');
    expect((await weatherAdapter({ fetchImpl: api([]) }).forDate('Cairo', '2098-05-01')).note).toBe('More than 16 days ahead');
    expect(fallback('2026-12-01', 'x').tempC).toBe(21);
  });
  test('WA-06 demo mode (WEATHER_MODE=estimate): never calls the service; the same estimate every run, labelled', async () => {
    const calls = [];
    const w = weatherAdapter({ fetchImpl: api(calls), mode: 'estimate' });
    const a = await w.forDate('Cairo', '2026-10-27'); const b = await w.forDate('Cairo', '2026-10-27');
    expect(calls).toHaveLength(0);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ tempC: 30, source: 'estimate', note: 'Seasonal estimate (demo mode)' });
  });
});

describe('Version 1.2 intents and calendar import', () => {
  const { parseIcs } = require('../../src/modules/planner/plannerModule');
  const { guessOccasion } = require('../../src/modules/assistant/keywordParser');
  test.each([
    ['AI-20', 'Do I own something similar to this black blazer?', 'similar_owned'],
    ['AI-21', 'I want to buy beige trousers. Do I need them?', 'buy_check'],
    ['AI-22', 'What is missing from my wardrobe?', 'closet_needs'],
    ['AI-23', 'What have I not worn recently?', 'forgotten'],
    ['AI-24', 'What should I wear to university tomorrow?', 'recommend'],
    ['AI-25', 'Style my blue skirt.', 'style_piece'],
  ])('%s “%s” → %s', (_id, msg, fn) => expect(parse(msg).fn).toBe(fn));
  test('AI-26 bags and jewellery are recognised', () => {
    expect(pieceQuery(' my black bag ')).toEqual({ colour: 'Black', category: 'Bag' });
    expect(pieceQuery(' gold earrings ')).toEqual({ colour: 'Yellow', category: 'Extra', name: 'earrings' }); // v1.5: the garment word is kept to match piece names
  });
  test('AI-27 calendar titles → occasion', () => {
    expect(guessOccasion("Nour's wedding")).toBe('Wedding');
    expect(guessOccasion('SE lecture')).toBe('University');
    expect(guessOccasion('Dentist')).toBeNull();
  });
  test('CAL-01 .ics: UTC time converted to Cairo, all-day events, escapes, folded lines', () => {
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Team dinner\\, Zamalek\r\nDTSTART:20261105T163000Z\r\nEND:VEVENT\r\n'
      + 'BEGIN:VEVENT\r\nSUMMARY:Long\r\n  title\r\nDTSTART;VALUE=DATE:20261101\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261101T100000\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(parseIcs(ics)).toEqual([
      { title: 'Team dinner, Zamalek', date: '2026-11-05', time: '18:30', allDay: false },
      { title: 'Long title', date: '2026-11-01', time: '09:00', allDay: true },
    ]);
  });
});
