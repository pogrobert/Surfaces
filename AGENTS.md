## @pogrobert/surfaces

For pictures a site repeats: covers, link previews, headers, avatars. A picture of one thing (a product) is a photo's job.
- Set up: `npx @pogrobert/surfaces init`, then `kit` (preview, headers, logo); `preview`, `check` verify.
- `brand = createBrand({ name: domain, color, logo? })`, or spread `readPage(html, css, designMd?)` in. Then `brand.cover|card|hero|og({ title })`, `brand.banner({ for: "x"|"linkedin"|"email" })`, `brand.avatar(id)`; React `<Cover brand title />`. No seeds; `id: slug` keeps art when a title changes; `tag` makes a category one family.
- `brand.look` keeps choices, `brand.why` explains. A person picks: `directions(choices)`, keep its `look`.
- One exact cover: `generate({ style, seed, color?, areas? })`, values from `catalog`.
- Alt: none under a heading; `label={title}` if it is the link.
- OG: `toJpeg(brand.og({ title }))` (`/png`), title drawn in; alt `describe(scene, { title })`. Edge: `{ wasm }`.
- Errors name the fix; `validate` checks. More: docs/api.md.
