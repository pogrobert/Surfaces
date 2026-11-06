## @pogrobert/surfaces

- Set up: `npx @pogrobert/surfaces init` writes the brand; `preview` to look, `check` to verify.
- Covers: `brand = createBrand({ name: domain, color })`, or spread `readPage(html, css)` in. Then `brand.cover|card|hero|og({ title })`, `brand.avatar(user.id)`, React `<Cover brand title />`. No seeds; `id: slug` keeps art when a title changes.
- `brand.look` stores the choices, `brand.why` explains them. To let a person choose: `directions(choices)`; keep the pick's `look`.
- One exact cover: `generate({ style, seed, color?, areas?, ... })`, listed values only (`inputSchema`, `catalog`). `areas`: `{ place, size?, art? }`, `place` like `bottom-left`; `size` `sm`/`md`/`lg`; `art` `"around"` or `"behind"`.
- Alt: no `label` under a heading; `label={title}` if the cover is the link.
- OG: `toJpeg(brand.og({ title }))` (`/png`), title drawn in; alt `describe(scene, { title })`. Edge/Workers: `{ wasm }`.
- Errors name the fix; `validate(input)` checks first.
