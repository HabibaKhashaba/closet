# Demo wardrobe illustrations

All 31 garment images in this folder are original illustrations drawn for Closet
(`docs/milestone2/art/garments.py`, rendered to JPEG; the red cropped tee is the white tee illustration recoloured). They are not photos of real products,
carry no third-party rights and contain no personal data. They are only used by `npm run seed`
to fill the demo account (demo@closet.app).

In the real app every piece is a photo the user takes; these illustrations only stand in for the demo.

## Photos added for the final demo (v3.0)

`brown_ankle_boots`, `beige_wide_leg_trousers`, `tan_leather_tote`, `light_wash_jeans`, `black_loafers`, `tortoise_sunglasses`, `structured_black_bag`, `nude_heels`, `beige_trench_coat` and every `nour_*`, `h_*` and `n_*` photo
are product-style photos collected by the team (T-24 – T-29), cropped to 640 × 800. They are not our own
photography; they are used only for the classroom demo and must be replaced or licensed before any public release.

The live demo (`npm run seed`) shows only real photos: `server/src/db/realPhotos.js` maps each piece to its photo,
renames it to match, and leaves out pieces we have no photo for (the dresses). The drawings remain only for the
automated tests and the offline demo.
