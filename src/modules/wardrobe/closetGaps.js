// US-64 closet gaps. Pure function, so it is easy to unit test.
// Acceptance criterion: a gap is ≤ 1 piece at a dress-code level the user dresses for.
// "Levels the user dresses for" = their usual dress code + the default level of each occasion they chose.
const { DRESS_CODES, OCCASIONS } = require('../../shared/vocabulary');

// Pieces are grouped the way an outfit is built: top or dress, bottom or layer, shoes.
const GROUPS = {
  'Tops & dresses': ['Top', 'Dress'],
  'Bottoms & layers': ['Bottom', 'Layer'],
  Shoes: ['Shoes'],
};
const GAP_LIMIT = 1;

function levelsUserDressesFor(profile) {
  const levels = new Set([profile.dressCode]);
  for (const occasion of profile.occasions || []) levels.add(OCCASIONS[occasion]);
  return [...levels].filter(Boolean).sort();
}

function closetGaps(items, profile) {
  const levels = levelsUserDressesFor(profile);
  const rows = Object.entries(GROUPS).map(([group, categories]) => {
    const counts = {};
    for (const level of [1, 2, 3, 4, 5]) {
      counts[level] = items.filter((i) => categories.includes(i.category) && i.dressCodes.includes(level)).length;
    }
    return { group, counts };
  });
  const gaps = [];
  for (const row of rows) {
    for (const level of levels) {
      if (row.counts[level] <= GAP_LIMIT) {
        gaps.push({
          group: row.group,
          level,
          levelName: DRESS_CODES[level],
          count: row.counts[level],
          message: `${row.counts[level]} ${DRESS_CODES[level].toLowerCase()} ${row.group.toLowerCase()}`,
        });
      }
    }
  }
  return { levels: levels.map((l) => ({ level: l, name: DRESS_CODES[l] })), rows, gaps };
}

module.exports = { closetGaps, levelsUserDressesFor, GAP_LIMIT };
