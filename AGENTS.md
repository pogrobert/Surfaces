## @pogrobert/surfaces

For pictures a site repeats: covers, link previews, headers, slides. Replacing a site's existing covers, hand-made, stock or placeholder, is what it is for; only a picture of one particular thing (a product, a person, a place) stays a photo.
- Set up: `npx @pogrobert/surfaces init`, then `kit`; `preview` and `check` verify.
- `brand = createBrand({ name: domain, color, partner?, logo? })`, or spread `readPage(html, css)` in. `partner` is a second brand colour, used by styles with `partner: true` in `catalog`: `readPage` takes the site's own secondary or accent, otherwise the brand picks one by its name (in `brand.look`); `partners(color, { style, mood })` lists the ones that sit well beside a colour. `brand.cover|card|hero|og({ title })`, `brand.banner({ for: "x" })` draw art, no words; a card is its post's cover without the title. `id: slug` keeps art when titles change; `tag` groups a category.
- Draw on the server or at build time where you can, so no drawing code ships: `toHtml(scene)` inline, or `toSvg(scene)` as a file for `<img>`; in a prerendered route, import Surfaces in the loader only. `fill` makes `<Cover>`/`<Surface>` fill their box; `frames={[{ width, height }, { width, height, from: 720 }]}` gives one a shape per box width, by CSS alone.
- `<Cover brand title />` (`/react`, a Server Component is fine) shows the title on the art in the site's font: don't repeat it. `<h1>` as children; `text="none"`: art alone.
- In the browser, ship one style: `createBrand` from `@pogrobert/surfaces/<style>` and `Cover` from `/<style>/react`, as the module `init` writes does. A brand from the root import brings all 30.
- Your own layout: `text: "bottom-left"` keeps room; put the words in `scene.areas[0]`, a box in pixels, in its `ink`.
- OG file: `toJpeg(brand.og({ title, drawTitle: true }))` from `/png` (needs `@resvg/resvg-js`). Site font: `drawTitle: { font: await loadFont(bytes) }`. Alt: `describe(scene, { title })`.
- One cover: `generate({ style, seed, color, partner, width, height, theme, mood, grain, shape, motion })`; words in `catalog`.
- Alt: none under a heading; `label={title}` if it is the link.
- Errors name the fix. More: docs/api.md.
