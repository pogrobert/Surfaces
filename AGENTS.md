## @pogrobert/surfaces

For pictures a site repeats: covers, link previews, headers, slides; not a product's photo.
- Set up: `npx @pogrobert/surfaces init`, then `kit`; `preview` and `check` verify.
- `brand = createBrand({ name: domain, color, logo? })`, or spread `readPage(html, css)` in. `brand.cover|card|hero|og({ title })`, `brand.banner({ for: "x" })` draw art, no words. `id: slug` keeps art when titles change; `tag` groups a category.
- `<Cover brand title />` (`/react`) shows the title on the art in the site's font: don't repeat it. `<h1>` as children; `text="none"`: art alone.
- `text: place` keeps room: `scene.areas[0]` box, `ink`.
- OG file: `toJpeg(brand.og({ title, drawTitle: true }))` from `/png` (needs `@resvg/resvg-js`); `drawTitle: { font }`, root `loadFont(bytes)`.
- One cover: `generate({ style, seed, color, width, height, theme, mood, grain, shape, motion })`; words in `catalog`.
- Alt: none under a heading; `label={title}` if it is the link.
- Errors name the fix. More: docs/api.md.
