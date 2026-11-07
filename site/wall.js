// The landing's wall, shared by the server, which draws it into the page so
// it shows with it, and the page, which draws it again in a site's own look
// once one is read, or on a shuffle. Plain JavaScript, so both can load it.

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

// Every tile is one small card a little wider than it is tall, so the wall
// reads as a grid of what the library draws, every style side by side.
const SIZE = { w: 1000, h: 750 }
export const TILES = 60
// How many the server draws: all of them, so the whole wall shows with the
// page, at about 260 KB gzipped.
export const FIRST = TILES

// The wall's tiles, the same for one shuffle wherever they are worked out:
// each a style, a size, a feel and a ground, and a sample brand until a site
// is read.
// As many as asked for: the server draws TILES, and a window that shows more
// asks for the rest.
export function tiles(shuffle = 0, count = TILES) {
  return Array.from({ length: count }, (_, i) => ({
    i,
    style: ORDER[(i * 7 + shuffle * 5) % ORDER.length],
    sample: SAMPLES[(i + shuffle) % SAMPLES.length],
    mood: [undefined, "calm", "bold"][i % 3],
    theme: i % 4 === 1 ? "dark" : "light",
    ...SIZE,
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
      return `<figure class="tile" data-i="${tile.i}"><div class="art"><div>${art}</div></div><figcaption>${label(tile, brand?.name)}</figcaption></figure>`
    })
    .join("")
}
