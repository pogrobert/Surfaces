// The landing's wall, shared by the server, which draws its first rows into
// the page so they show with it, and the page, which draws the rest as they
// scroll near and draws it all again in a site's own look once it is read.
// Plain JavaScript, so both can load it.

// Sites like yours, whose pictures the wall shows until yours is read.
export const SAMPLES = [
  { name: "harbour.dev", color: "#0078bf" },
  { name: "fernhouse.co", color: "#00838a" },
  { name: "quietpages.org", color: "#3d5588" },
  { name: "ottoloop.fm", color: "#f15060" },
  { name: "pantry.app", color: "#ff6c2f" },
  { name: "longfield.press", color: "#00a95c" },
]

// Every style, in the kinds the explorer lists them by.
export const KINDS = [
  ["Printed", ["stencil", "screenprint", "riso", "photocopy", "halftone", "dither"]],
  ["Engraved", ["engraving", "linework", "moire", "mezzotint", "aquatint"]],
  ["Light", ["underpaint", "sfumato", "fluted", "chrome", "glass"]],
  ["Pattern", ["marbling", "strata", "endpaper"]],
]
const ORDER = KINDS.flatMap(([, styles]) => styles)

// The shapes a wall tile takes, as the places a site shows pictures do, and
// how many of the grid's rows each spans.
const SIZES = [
  { w: 1600, h: 900, rows: 15 },
  { w: 1000, h: 1000, rows: 26 },
  { w: 960, h: 1200, rows: 32 },
  { w: 1500, h: 500, rows: 9 },
  { w: 900, h: 1600, rows: 44 },
  { w: 1200, h: 630, rows: 14 },
  { w: 1000, h: 1000, rows: 26 },
  { w: 1600, h: 800, rows: 13 },
]
export const TILES = 42
// How many the server draws: the wall's first rows, all a wide window shows.
export const FIRST = 18

// The wall's tiles, the same for one shuffle wherever they are worked out:
// each a style, a size, a feel and a ground, and a sample brand until a site
// is read.
export function tiles(shuffle = 0) {
  return Array.from({ length: TILES }, (_, i) => ({
    i,
    style: ORDER[(i * 7 + shuffle * 5) % ORDER.length],
    sample: SAMPLES[(i + shuffle) % SAMPLES.length],
    mood: [undefined, "calm", "bold"][i % 3],
    theme: i % 4 === 1 ? "dark" : "light",
    ...SIZES[(i * 3 + shuffle) % SIZES.length],
    id: `wall-${i}-${shuffle}`,
  }))
}

// A tile's scene, in the brand given or its sample's.
export function scene(tile, generate, brand) {
  const look = brand ?? { name: tile.sample.name, color: tile.sample.color }
  return generate({
    style: tile.style,
    seed: `${look.name}/${tile.id}`,
    ...(look.color ? { color: look.color } : null),
    theme: tile.theme,
    ...(tile.mood ? { mood: tile.mood } : null),
    width: tile.w,
    height: tile.h,
  })
}

const NAME = (style) => style[0].toUpperCase() + style.slice(1)
export const label = (tile, name) => `${NAME(tile.style)}${tile.mood ? `, ${tile.mood}` : ""}${tile.theme === "dark" ? ", dark" : ""} · ${name ?? tile.sample.name}`

// The wall as HTML: the first `drawn` tiles with their art, the rest empty
// until the page draws them.
export function wall(list, generate, toHtml, { drawn = FIRST, brand } = {}) {
  return list
    .map((tile) => {
      const art = tile.i < drawn ? toHtml(scene(tile, generate, brand), { fill: true }) : ""
      return `<figure class="tile" data-i="${tile.i}" style="grid-row:span ${tile.rows}"><div class="art"><div>${art}</div></div><figcaption>${label(tile, brand?.name)}</figcaption></figure>`
    })
    .join("")
}
