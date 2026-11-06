## @pogrobert/surfaces

- Covers: `brand = createBrand({ name: domain, color })` once; spread `readPage(html, css)` in to choose style/colour from the site. Then `brand.cover|card|hero|og({ title })`, `brand.avatar(user.id)`, React `<Cover brand title />`.
- `id: slug` keeps art when a title changes. No seeds.
- `brand.look` stores the choices; `brand.why` explains them. To let a person choose: `directions(choices)` → brands to show; keep the picked one's `look`.
- Exact one-off: `generate({ style, seed, color?, areas?, ... })`, listed values only (`inputSchema`, `catalog`). `areas`: `{ place, size?, art? }`, `place` like `bottom-left`, `center`; `size` `sm`/`md`/`lg`; `art` `"around"` or `"behind"` (card).
- Alt: no `label` under a heading; `label={title}` if the cover is the link.
- OG: `toJpeg(brand.og({ title }))` (`/png`), title drawn in; alt `describe(scene, { title })`. Edge/Workers: pass `{ wasm }`.
- Errors name the fix; `validate(input)` checks first.
