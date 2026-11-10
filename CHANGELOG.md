# Changelog

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
