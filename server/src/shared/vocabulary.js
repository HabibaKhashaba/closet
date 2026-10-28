// Domain vocabulary (requirements section 3.1). Client, API and database use these exact values.

const DRESS_CODES = { 1: 'Casual', 2: 'Smart Casual', 3: 'Business Casual', 4: 'Semi-Formal', 5: 'Formal' };

// Each occasion has a default dress-code level.
const OCCASIONS = {
  Everyday: 1, University: 1, Travel: 1,
  Dinner: 2, 'Date night': 2,
  Work: 3, Interview: 3,
  Party: 4,
  Wedding: 5,
};

const STYLES = ['Casual', 'Chic', 'Minimal', 'Elegant', 'Classic', 'Sporty', 'Streetwear', 'Comfortable', 'Bold'];

const COLOURS = ['Black', 'White', 'Grey', 'Beige', 'Brown', 'Navy', 'Blue', 'Green', 'Red',
  'Pink', 'Purple', 'Yellow', 'Orange', 'Multicolour'];

// An outfit is up to 4 pieces: top or dress, bottom or layer, shoes, and a bag or accessory.
// The web app shows Layer as "Outerwear" and Extra as "Accessories".
const CATEGORIES = ['Top', 'Dress', 'Bottom', 'Layer', 'Shoes', 'Bag', 'Extra'];

// US-13: why a piece left the closet. Each reason has a defined effect (shopping/deletionPolicy.js):
// Torn / damaged and Became too small → replacement on the shopping list; No longer my style → learned, never re-suggested.
const DELETE_REASONS = ['Torn / damaged', 'No longer my style', 'Became too small', 'Other'];

const FABRICS = ['Cotton', 'Linen', 'Wool', 'Denim', 'Silk', 'Polyester', 'Leather', 'Knit', 'Other'];

const SEASONS = ['Summer', 'Winter', 'Spring / Autumn', 'All seasons'];

const STATUSES = ['Available', 'Laundry', 'Borrowed', 'Packed', 'Unavailable'];

// US-90 occasion templates: one tap fills occasion, dress-code level and style; the user can still edit them.
// weather: how much the forecast matters (outdoor = the forecast is used as is; indoor = shown as a hint).
const OCCASION_TEMPLATES = [
  { key: 'university', label: 'University', occasion: 'University', level: 1, style: 'Casual', weather: 'outdoor', icon: 'book' },
  { key: 'work', label: 'Work', occasion: 'Work', level: 3, style: 'Classic', weather: 'indoor', icon: 'briefcase' },
  { key: 'dinner', label: 'Dinner', occasion: 'Dinner', level: 2, style: 'Chic', weather: 'indoor', icon: 'dinner' },
  { key: 'wedding', label: 'Wedding', occasion: 'Wedding', level: 5, style: 'Elegant', weather: 'indoor', icon: 'ring' },
  { key: 'casual-outing', label: 'Casual outing', occasion: 'Everyday', level: 1, style: 'Casual', weather: 'outdoor', icon: 'sun' },
  { key: 'formal-event', label: 'Formal event', occasion: 'Party', level: 5, style: 'Elegant', weather: 'indoor', icon: 'sparkle' },
  { key: 'travel', label: 'Travel', occasion: 'Travel', level: 1, style: 'Comfortable', weather: 'outdoor', icon: 'plane' },
  { key: 'gym', label: 'Gym', occasion: 'Everyday', level: 1, style: 'Sporty', weather: 'indoor', icon: 'bolt' },
  { key: 'interview', label: 'Interview', occasion: 'Interview', level: 3, style: 'Classic', weather: 'indoor', icon: 'briefcase' },
];

module.exports = { DRESS_CODES, OCCASIONS, STYLES, COLOURS, CATEGORIES, DELETE_REASONS, FABRICS, SEASONS, STATUSES, OCCASION_TEMPLATES };
