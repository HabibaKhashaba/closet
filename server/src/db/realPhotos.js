// Live demo (npm run seed) only: every piece shown with a real photo instead of a drawing.
// key (the piece's id in seedData) → { file, name, details } overrides, or null = not in the live demo closet.
// The automated tests and the offline demo still use seedData as it is, so nothing here can break a test.
const R = (file, name, details = {}) => ({ file, name, details });
const HABIBA = {
  white_fitted_tee: R('h_cream_sheer_top', 'Cream sheer top', { fabric: 'Polyester' }),
  red_cropped_tee: R('nour_red_merino_sweater', 'Red merino sweater', { fabric: 'Wool', season: 'Winter' }),
  black_ribbed_top: R('h_brown_knit_polo', 'Brown knit polo', { colour: 'Brown' }),
  blue_oxford_shirt: R('h_grey_boucle_cardigan', 'Grey bouclé cardigan', { colour: 'Grey', fabric: 'Knit' }),
  cream_knit_sweater: R('h_striped_knit_tee', 'Striped knit tee', { colour: 'Green', season: 'Summer' }),
  ivory_silk_blouse: R('nour_lime_cami', 'Lime satin cami', { colour: 'Yellow' }),
  breton_striped_top: R('nour_olive_tee', 'Olive boxy tee', { colour: 'Green' }),
  blush_satin_cami: null,
  sage_linen_shirt: null,
  black_tailored_trousers: R('h_black_leather_shorts', 'Black leather shorts', { fabric: 'Leather' }),
  light_wash_jeans: R('light_wash_jeans', 'Cuffed wide jeans'),
  beige_wide_leg_trousers: R('beige_wide_leg_trousers', 'Cream wide-leg trousers'),
  cream_pleated_skirt: R('h_grey_pleated_skirt', 'Grey pleated skirt', { colour: 'Grey' }),
  black_midi_skirt: R('h_grey_wool_skirt', 'Grey wool mini skirt', { colour: 'Grey', fabric: 'Wool' }),
  navy_silk_midi_dress: null, rose_wrap_dress: null, emerald_satin_dress: null,
  navy_blazer: R('h_grey_check_jacket', 'Grey check jacket', { colour: 'Grey' }),
  black_blazer: R('h_black_leather_coat', 'Black leather coat', { fabric: 'Leather' }),
  beige_trench_coat: R('beige_trench_coat', 'Cream cropped jacket'),
  denim_jacket: R('h_shearling_coat', 'Brown shearling coat', { colour: 'Brown', fabric: 'Leather', season: 'Winter' }),
  camel_cardigan: R('h_tan_suede_jacket', 'Tan suede jacket', { fabric: 'Leather' }),
  white_sneakers: R('h_cream_ballet_flats', 'Cream ballet flats'),
  black_loafers: R('black_loafers', 'Black square loafers'),
  nude_heels: R('nude_heels', 'Peep-toe heels'),
  gold_strappy_heels: R('h_pink_strappy_heels', 'Pink strappy heels', { colour: 'Pink' }),
  tan_sandals: R('h_black_pointed_mules', 'Black pointed mules', { colour: 'Black' }),
  brown_ankle_boots: R('brown_ankle_boots', 'Brown suede boots'),
  structured_black_bag: R('structured_black_bag', 'Black woven bag'),
  tan_leather_tote: R('tan_leather_tote', 'Brown slouchy bag'),
  champagne_evening_bag: R('h_fur_bag', 'Brown fur bag', { colour: 'Brown', fabric: 'Other' }),
  silk_scarf: R('h_white_belt', 'White leather belt', { colour: 'White', fabric: 'Leather' }),
  gold_hoop_earrings: R('h_black_sunglasses', 'Black sunglasses', { colour: 'Black' }),
  tortoise_sunglasses: R('tortoise_sunglasses', 'Amber sunglasses'),
};
const NOUR = {
  nour_red_merino_sweater: null, nour_olive_tee: null, nour_lime_cami: null,   // these photos are Habiba's now
  silver_heels: R('n_pointed_heels', 'Black pointed heels', { colour: 'Black' }),
  red_clutch: R('n_brown_pouch', 'Brown pouch bag', { colour: 'Brown' }),
  black_slip_dress: null, rose_wrap_dress: null, sage_linen_shirt: null,
  camel_cardigan: R('n_fur_jacket', 'Fur bomber jacket', { colour: 'Beige' }),
  cream_pleated_skirt: R('n_grey_skirt', 'Grey A-line skirt', { colour: 'Grey' }),
  white_sneakers: R('n_black_ballet_flats', 'Black ballet flats', { colour: 'Black' }),
  tan_leather_tote: R('n_fur_shoulder_bag', 'Fur shoulder bag', { colour: 'Beige', fabric: 'Other' }),
};
// [file, name, details, ...rest] → the live version, or null
function live(map, row) {
  const [file, name, details, ...rest] = row;
  if (!(file in map)) return row;
  const r = map[file];
  if (!r) return null;
  const out = [file, r.name, { ...details, ...r.details }, ...rest];
  out.photo = r.file;
  return out;
}
module.exports = { HABIBA, NOUR, live };
