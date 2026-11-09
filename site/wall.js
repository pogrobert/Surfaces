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
  ["Printed", ["stencil", "screenprint", "riso", "linocut", "photocopy", "halftone", "dither", "typewriter"]],
  ["Engraved", ["engraving", "linework", "currents", "dashes", "moire", "mezzotint", "aquatint"]],
  ["Light", ["underpaint", "sfumato", "trails", "prism", "fluted", "chrome", "glass"]],
  ["Made", ["papercut", "weave", "terrazzo", "swatchbook"]],
  ["Pattern", ["marbling", "strata", "endpaper", "patches"]],
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

// A tile's scene, in the colour given or its sample's. The drawing is always
// its own, so picking a colour repaints the wall rather than redrawing it.
export function scene(tile, generate, color) {
  return generate({
    style: tile.style,
    seed: `${tile.sample.name}/${tile.id}`,
    color: color ?? tile.sample.color,
    theme: tile.theme,
    ...(tile.mood ? { mood: tile.mood } : null),
    width: tile.w,
    height: tile.h,
  })
}

const NAME = (style) => style[0].toUpperCase() + style.slice(1)
export const label = (tile) => `${NAME(tile.style)}${tile.mood ? `, ${tile.mood}` : ""}${tile.theme === "dark" ? ", dark" : ""}`

// The wall as HTML: the first `drawn` tiles with their art, the rest empty
// until the page draws them.
// Each tile is a button: it opens the explorer on its style.
export function wall(list, generate, toHtml, { drawn = FIRST, color } = {}) {
  return list
    .map((tile) => {
      const art = tile.i < drawn ? toHtml(scene(tile, generate, color), { fill: true }) : ""
      return `<button type="button" tabindex="-1" class="tile" data-i="${tile.i}" data-style="${tile.style}" aria-label="${label(tile)}"><span class="art"><span>${art}</span></span><span class="label">${label(tile)}</span></button>`
    })
    .join("")
}
