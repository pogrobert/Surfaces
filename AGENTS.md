## @pogrobert/surfaces

- Set up: `npx @pogrobert/surfaces init`, then `kit` (preview, headers); `preview`, `check` to verify.
- `brand = createBrand({ name: domain, color })`, or spread `readPage(html, css)` in. Then `brand.cover|card|hero|og({ title })`, `brand.banner({ for: "x"|"linkedin"|"email" })`, `brand.icon()`, `brand.avatar(user.id)`; React `<Cover brand title />`. No seeds; `id: slug` keeps art when a title changes; `tag` makes a category one family.
- `brand.look` keeps choices, `brand.why` explains. For a person to pick: `directions(choices)`, keep its `look`.
- One exact cover: `generate({ style, seed, color?, areas?, ... })`, values from `catalog`. `areas`: `{ place: "bottom-left"…, size: "sm"|"md"|"lg", art?: "around"|"behind" }`.
- Alt: none under a heading; `label={title}` if the cover is the link.
- OG: `toJpeg(brand.og({ title }))` (`/png`), title drawn in; alt `describe(scene, { title })`. Edge/Workers: `{ wasm }`.
- Errors name the fix; `validate` checks.
