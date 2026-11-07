## @pogrobert/surfaces

For pictures a site repeats: covers, link previews, headers, avatars, not a product's photo.
- Set up: `npx @pogrobert/surfaces init`, then `kit` (preview, headers); `preview`, `check` verify.
- `brand = createBrand({ name: domain, color, logo? })`, or spread `readPage(html, css, designMd?)` in. Then `brand.cover|card|hero|og({ title })`, `brand.banner({ for: "x"|"linkedin"|"email" })`, `brand.avatar(id)`. `id: slug` keeps art when titles change; `tag` groups a category.
- `brand.look` keeps choices, `brand.why` explains; `directions(choices)` lets a person pick.
- One exact cover: `generate({ style, seed, color?, areas? })`, from `catalog`.
- Images are art: set titles in the site's font, as `<Cover brand title />` does. `text: place` keeps room (`scene.areas[0]` box, `ink`). OG file: `toJpeg(brand.og({ title, drawTitle: true }))` (`/png`); edge `{ wasm }`.
- Alt: none under a heading; `label={title}` if it is the link.
- Errors name the fix; `validate` checks. More: docs/api.md.
