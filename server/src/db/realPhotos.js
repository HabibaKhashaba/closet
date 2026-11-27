// Live demo (npm run seed) only: every piece shown with a real photo instead of a drawing.
// key (the piece's id in seedData) → { file, name, details } overrides, or null = not in the live demo closet.
// EXTRA_* are pieces that exist only in the live demo. Tests and the offline demo use seedData as it is.
const R = (file, name, details = {}) => ({ file, name, details });
const HABIBA = {
  white_fitted_tee: R('p_0145', 'Cream draped knit top', { fabric: 'Knit' }),
  red_cropped_tee: R('p_0120', 'Red merino sweater', { fabric: 'Wool', season: 'Winter' }),
  black_ribbed_top: R('p_0150', 'Black draped knit top'),
  blue_oxford_shirt: R('p_0146', 'Grey wrap top', { colour: 'Grey', fabric: 'Knit' }),
  cream_knit_sweater: R('p_0148', 'Cream off-shoulder sweater'),
  ivory_silk_blouse: R('p_0160', 'Ivory scarf-neck top', { fabric: 'Knit' }),
  breton_striped_top: R('p_0158', 'Blue striped sweater', { fabric: 'Knit' }),
  blush_satin_cami: R('p_0176', 'Burgundy scarf top', { colour: 'Red' }),
  sage_linen_shirt: R('p_0149', 'Oatmeal cropped knit', { colour: 'Beige', fabric: 'Knit' }),
  black_tailored_trousers: R('p_0153', 'Black flared trousers'),
  light_wash_jeans: R('p_0154', 'Light-wash flared jeans'),
  beige_wide_leg_trousers: R('p_0144', 'Pale grey wide-leg trousers', { colour: 'Grey' }),
  cream_pleated_skirt: R('p_0203', 'Mint chiffon maxi skirt', { colour: 'Green', fabric: 'Silk' }),
  black_midi_skirt: R('p_0127', 'Denim mini skirt', { colour: 'Blue', fabric: 'Denim' }),
  navy_silk_midi_dress: R('p_0196', 'Navy fringe dress'),
  rose_wrap_dress: R('p_0192', 'Red chiffon gown', { colour: 'Red', dressCodes: [4, 5] }),
  emerald_satin_dress: R('p_0186', 'Black crystal gown', { colour: 'Black' }),
  navy_blazer: R('p_0119', 'Grey pinstripe blazer', { colour: 'Grey' }),
  black_blazer: R('p_0181', 'Black belted jacket', { fabric: 'Denim' }),
  beige_trench_coat: R('p_0174', 'Brown belted coat', { colour: 'Brown', fabric: 'Wool' }),
  denim_jacket: R('p_0147', 'Denim jacket'),
  camel_cardigan: R('p_0178', 'Brown wrap cardigan'),
  white_sneakers: R('p_0164', 'Beige slouch boots', { colour: 'Beige', fabric: 'Other' }),
  black_loafers: R('p_0200', 'Black patent pumps'),
  nude_heels: R('p_0199', 'Ivory pumps', { colour: 'White' }),
  gold_strappy_heels: R('p_0168', 'Burgundy patent mules', { colour: 'Red' }),
  tan_sandals: R('p_0167', 'Brown slouch boots', { season: 'Winter' }),
  brown_ankle_boots: R('p_0165', 'Brown fringe boots', { fabric: 'Other' }),
  structured_black_bag: R('structured_black_bag', 'Black woven bag'),
  tan_leather_tote: R('tan_leather_tote', 'Brown slouchy bag'),
  champagne_evening_bag: R('h_fur_bag', 'Brown fur bag', { colour: 'Brown', fabric: 'Other' }),
  silk_scarf: R('p_0163', 'Cream fringed wrap', { colour: 'White', fabric: 'Wool' }),
  gold_hoop_earrings: R('h_black_sunglasses', 'Black sunglasses', { colour: 'Black' }),
  tortoise_sunglasses: R('tortoise_sunglasses', 'Amber sunglasses'),
};
const T = (styles, dressCodes, extra = {}) => ({ season: 'All seasons', size: 'S', styles, dressCodes, modest: true, ...extra });
const GOWN = (colour, fabric = 'Silk', modest = true) => ({ category: 'Dress', colour, fabric, ...T(['Elegant', 'Chic'], [4, 5], { modest }) });
// [file, name, details] — only in the live demo
const EXTRA_HABIBA = [
  ['p_0183', 'Champagne draped gown', GOWN('Beige')],
  ['p_0185', 'Gold sequin gown', GOWN('Yellow', 'Other')],
  ['p_0194', 'Navy floral sequin gown', GOWN('Navy', 'Other')],
  ['p_0198', 'Red rose pumps', { category: 'Shoes', colour: 'Red', fabric: 'Other', ...T(['Elegant', 'Bold'], [3, 4, 5]) }],
  ['p_0177', 'Burgundy wide trousers', { category: 'Bottom', colour: 'Red', fabric: 'Wool', ...T(['Chic', 'Classic'], [2, 3, 4]) }],
  ['p_0143', 'Navy fold-over trousers', { category: 'Bottom', colour: 'Navy', fabric: 'Knit', ...T(['Casual', 'Comfortable'], [1, 2]) }],
  ['p_0151', 'Brown wide-leg trousers', { category: 'Bottom', colour: 'Brown', fabric: 'Silk', ...T(['Chic', 'Minimal'], [1, 2, 3]) }],
  ['p_0156', 'Striped knit trousers', { category: 'Bottom', colour: 'Brown', fabric: 'Knit', ...T(['Casual', 'Comfortable'], [1]) }],
  ['p_0204', 'Mint flared trousers', { category: 'Bottom', colour: 'Green', fabric: 'Polyester', ...T(['Chic', 'Bold'], [1, 2, 3]) }],
  ['p_0157', 'Red striped sweater', { category: 'Top', colour: 'Red', fabric: 'Knit', ...T(['Casual', 'Comfortable'], [1, 2]) }],
  ['p_0161', 'Grey twist sweater', { category: 'Top', colour: 'Grey', fabric: 'Knit', ...T(['Casual', 'Minimal'], [1, 2]) }],
  ['p_0162', 'Brown belted scarf top', { category: 'Top', colour: 'Brown', fabric: 'Knit', ...T(['Chic', 'Bold'], [1, 2, 3]) }],
  ['p_0173', 'Brown wool jacket', { category: 'Layer', colour: 'Brown', fabric: 'Wool', ...T(['Classic', 'Chic'], [1, 2, 3, 4]) }],
  ['p_0172', 'Burgundy cape', { category: 'Layer', colour: 'Red', fabric: 'Wool', ...T(['Elegant', 'Chic'], [2, 3, 4]) }],
  ['p_0171', 'Burgundy fringed poncho', { category: 'Layer', colour: 'Red', fabric: 'Wool', ...T(['Comfortable', 'Chic'], [1, 2]) }],
];
const NOUR = {
  silver_heels: R('p_0166', 'Black buckle boots', { colour: 'Black', fabric: 'Other' }),
  red_clutch: R('n_brown_pouch', 'Brown pouch bag', { colour: 'Brown' }),
  black_slip_dress: R('p_0188', 'Black lace gown'),
  rose_wrap_dress: R('p_0191', 'Yellow halter dress', { colour: 'Yellow', fabric: 'Silk' }),
  camel_cardigan: R('p_0170', 'Cream long cardigan', { colour: 'White' }),
  sage_linen_shirt: R('p_0182', 'Grey cropped sweatshirt', { colour: 'Grey', fabric: 'Cotton' }),
  cream_pleated_skirt: R('p_0152', 'Sage wide trousers', { colour: 'Green' }),
  white_sneakers: R('n_black_ballet_flats', 'Black ballet flats', { colour: 'Black' }),
  tan_leather_tote: R('n_fur_shoulder_bag', 'Fur shoulder bag', { colour: 'Beige', fabric: 'Other' }),
  nour_red_merino_sweater: null, nour_olive_tee: null, nour_lime_cami: null, nour_grey_pinstripe_blazer: null,
};
const EXTRA_NOUR = [
  ['p_0184', 'Ivory satin gown', GOWN('White')],
  ['p_0187', 'Black beaded cape dress', GOWN('Black', 'Polyester')],
  ['p_0189', 'Silver sequin gown', GOWN('Grey', 'Other', false)],
  ['p_0190', 'Orange crystal gown', GOWN('Orange', 'Other', false)],
  ['p_0193', 'Red satin mermaid gown', GOWN('Red')],
  ['p_0195', 'Pearl gown with blue drape', GOWN('Beige', 'Other')],
  ['p_0197', 'Burgundy ruffle gown', GOWN('Red')],
  ['p_0201', 'White lace gown', GOWN('White', 'Other', false)],
  ['p_0202', 'Mint halter gown', GOWN('Green')],
  ['p_0175', 'Dark brown belted coat', { category: 'Layer', colour: 'Brown', fabric: 'Wool', ...T(['Classic', 'Elegant'], [2, 3, 4]) }],
  ['p_0179', 'Brown knit cape', { category: 'Layer', colour: 'Brown', fabric: 'Knit', ...T(['Chic'], [1, 2, 3]) }],
  ['p_0169', 'Brown fringe jacket', { category: 'Layer', colour: 'Brown', fabric: 'Wool', ...T(['Chic', 'Bold'], [1, 2, 3]) }],
  ['p_0180', 'Tan leather jacket', { category: 'Layer', colour: 'Brown', fabric: 'Leather', ...T(['Classic'], [1, 2, 3]) }],
  ['p_0155', 'Mid-wash flared jeans', { category: 'Bottom', colour: 'Blue', fabric: 'Denim', ...T(['Casual'], [1, 2]) }],
  ['p_0159', 'Charcoal flared trousers', { category: 'Bottom', colour: 'Grey', fabric: 'Knit', ...T(['Casual', 'Comfortable'], [1, 2]) }],
  ['p_0125', 'Cuffed wide jeans', { category: 'Bottom', colour: 'Blue', fabric: 'Denim', ...T(['Casual'], [1, 2]) }],
];
// [file, name, details, ...rest] → the live version (row.photo = the image to upload), or null
function live(map, row) {
  const [file, name, details, ...rest] = row;
  if (!(file in map)) return row;
  const r = map[file];
  if (!r) return null;
  const out = [file, r.name, { ...details, ...r.details }, ...rest];
  out.photo = r.file;
  return out;
}
module.exports = { HABIBA, NOUR, EXTRA_HABIBA, EXTRA_NOUR, live };
