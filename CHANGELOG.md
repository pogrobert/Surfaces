# Changelog

## Unreleased

- **`coverHtml` and `surfaceHtml`**: `<Cover>` and `<Surface>` as a string
  of HTML, the same markup byte for byte, for any page that can place HTML:
  Vue's `v-html`, Svelte's `{@html}`, Astro's `set:html`, a template or a
  build script. The title, `fill`, `frames`, `label` and `paused` all work
  as they do in React. They come from the root import and every style's own;
  `coverHtml` draws with the styles its brand was made with.
- **`heading` on `<Cover>`** (and `coverHtml`) sets the title as that
  heading, `"h1"` to `"h6"`, at the same size, so the page's heading needs no
  children. The title's block has `margin: 0`, so a heading's own margins
  never move it.

## 0.1.2

- **`frames` on `<Cover>` and `<Surface>`**: a box that changes shape as it
  widens gets a drawing for each shape, shown by its own width with CSS
  container queries alone, no script, so it renders on a server like any
  still cover. The content is rendered once and moved into each frame's area.
- **Second colours chosen from what is known about colour pairs**
  (docs/colour.md). A calm brand takes a neighbouring hue and a bold one a
  contrast, warm against cool, never the opposite hue; Riso and Screenprint
  take a real riso ink whose overlap with the brand's colour stays a colour,
  not mud; red is never paired with green. `partners(color, { style, mood })`
  lists them.
- **A partner the brand gives keeps its own lightness**, as near as the style
  allows and clear of the ground, so a deep second colour stays deep; on a
  dark ground it is drawn a little lighter and softer.
- **A warm brand's dark ground keeps most of its tint**, so on a site's own
  near-black page a cover still has an edge.
- **Fluted's shapes are three silhouettes**: the arch standing, the panel a
  window on its side, the band a strip across. Two tags can still land on
  one shape; give a section its own `shape` for marks that must differ.
- **`fill`** on `<Cover>` and `<Surface>` fills the box they are put in, a
  card's or a header's, cropped to fit, instead of keeping their own shape.
- A partner given with a one-hue style draws silently instead of warning,
  since a brand shares one look across styles; `check` still notes it.
- The docs show how to ship no drawing code at all: a still cover drawn in
  a server component, a prerendered route's loader or a build script. And
  a style's own import is said to add about 45–55 KB gzipped, as measured
  across styles, not 46.

## 0.1.1

- **A brand's second colour.** `createBrand({ name, color, partner })`, or
  `partner` in an input: the styles that set a second hue beside the brand's
  take its hue instead of one chosen for them. Each keeps its own lightness,
  so the colour given can't make a cover unreadable, and the drawing doesn't
  change, only its colour.
- **Underpaint's glow.** Underpaint has two shapes now: `aura`, as before,
  and `glow`, the brand's colour alone in three shades, soft as haze and
  filling the cover, for a card with content laid over it. The seed picks
  either; give `shape` to keep one.
- **One style alone.** `@pogrobert/surfaces/<style>` and
  `@pogrobert/surfaces/<style>/react` are the same functions drawing only
  that style, so a page that draws in the browser carries one style's code:
  a `<Cover>` adds about 46 KB gzipped instead of 120. A brand made there is
  in that style; another style throws and names the import that has it.
- **`<Cover>` and `<Surface>` render in a React Server Component.** A still
  cover is plain markup with no hooks, so it needs no client code at all; a
  moving one gets a small client part that starts and rests its motion.
- **`init` writes the brand module with its style's own import**, so a site
  that draws in the browser ships that one style.
- **A better second colour.** Each hue has two or three partners a printer
  would pair with it (blue with a fluorescent pink, a coral or an aqua; teal
  with a coral, a violet or a pink), instead of one for every brand of that
  hue, and a brand picks one by its name and keeps it in `brand.look`.
  `readPage` takes a site's own secondary or accent colour as its partner.
- `catalog` says which styles use a `partner` (`partner: true`), and a
  partner given to a one-hue style warns that it changes nothing.
- The HTTP handler, given `jpeg`, serves JPEG to a URL without a `format`,
  since an `og:image` can't be an SVG; and `?theme=` keeps the brand's logo.
- The command is listed as `dist/cli.js`, as npm writes it.

## 0.1.0

The first release.

- **Brands.** `createBrand({ name, color })`, or from a site's own pages with
  `readPage(html, css)`: one look, decided once, and `brand.cover`, `card`,
  `hero`, `og` and `banner` draw every picture after it from what it is
  about. `directions` offers several looks to choose from.
- **Thirty styles**, each with its own shapes, in light or dark, calm or
  bold, with smooth, natural or heavy grain. Nineteen move when asked to.
  `catalog` describes each in plain words.
- **Words in your own font.** Covers are art; a title is set by the page over
  the place the art keeps for it, by `<Cover>` in React, or drawn into an
  image file with `drawTitle`, in a bundled face or the site's own font file.
  Words over art are measured, and get ground under them only where the art
  needs it.
- **Every output.** `toHtml` (inline, the only one that moves), `toSvg`,
  `toPng` and `toJpeg` (through resvg, native or WASM), a fetch handler for
  link previews from a URL, React components and a DOM `mount`.
- **A command line.** `init` reads a site and writes its brand, `kit` writes
  its link preview and profile headers, `preview` and `check` look and
  verify.
- **For agents.** `AGENTS.md`, `llms.txt`, a JSON Schema of the input, notes
  on every public type, and errors that name the fix.
- **The same bytes everywhere.** One input draws one picture, in Node, a
  browser or an edge runtime, on V8 and JavaScriptCore alike.
