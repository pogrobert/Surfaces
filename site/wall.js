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

// What a wall tile is, in the shapes a site's pictures take: a page's wide
// hero, a post's cover card, and squares, small and large. Each spans its
// columns of the grid and as many of its rows as its shape needs.
const KINDS_OF_TILE = {
  hero: { w: 2400, h: 1200, cols: 3, rows: 18 },
  card: { w: 1600, h: 900, cols: 2, rows: 14 },
  square: { w: 1000, h: 1000, cols: 1, rows: 12 },
  large: { w: 1200, h: 1200, cols: 2, rows: 24 },
}
const RUN = ["hero", "square", "card", "square", "large", "square", "card", "square", "hero", "square", "card", "large", "square", "card", "square"]
export const TILES = 36
// How many the server draws: the wall's first rows, all a wide window shows.
export const FIRST = 16

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
    kind: RUN[(i + shuffle * 2) % RUN.length],
    ...KINDS_OF_TILE[RUN[(i + shuffle * 2) % RUN.length]],
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
      return `<figure class="tile" data-i="${tile.i}" data-kind="${tile.kind}" style="grid-row:span ${tile.rows}"><div class="art"><div>${art}</div></div><figcaption>${label(tile, brand?.name)}</figcaption></figure>`
    })
    .join("")
}
