// The hero's marks, shared by the server, which draws the first ones into
// the page so they show with it, and the page, which redraws them in a
// site's own look once it is read. Plain JavaScript, so both can load it.

// Sites like yours, whose marks the hero shows until yours is read.
export const SAMPLES = [
  { name: "harbour.dev", style: "screenprint", color: "#0078bf" },
  { name: "fernhouse.co", style: "stencil", color: "#00838a" },
  { name: "quietpages.org", style: "engraving", color: "#3d5588" },
  { name: "ottoloop.fm", style: "riso", color: "#f15060" },
  { name: "pantry.app", style: "halftone", color: "#ff6c2f" },
  { name: "longfield.press", style: "marbling", color: "#00a95c" },
]

// Where the marks go, in shares of the hero: a loose ring round the middle.
// Each size is in pixels on a 1440-wide window; CSS scales it from there.
export const SPOTS = [[8, 12], [24, 6], [44, 9], [66, 5], [86, 10], [93, 34], [88, 62], [90, 86], [70, 90], [50, 88], [30, 92], [10, 84], [5, 58], [9, 34], [76, 28], [20, 30], [80, 74], [18, 66]]

// The marks as HTML, one look after another round the ring. Each is drawn
// on both its grounds, so it follows the reader's light or dark mode as the
// page does. Those in the middle band are marked, so a narrow screen can
// leave them out before any script runs.
export function marks(looks, createBrand, toHtml) {
  const brands = looks.map((look) => createBrand({ ...look, theme: "auto" }))
  return SPOTS.map(([x, y], i) => {
    const square = i % 3 === 0
    const size = 70 + ((i * 37) % 80)
    const turn = ((i * 53) % 40) - 20
    const art = toHtml(brands[i % brands.length].avatar(`mark-${i}`, { square }), { fill: true })
    return `<div class="mark${y > 20 && y < 80 ? " mid" : ""}" style="--x:${x}%;--y:${y}%;--s:${size};--r:${turn}deg;border-radius:${square ? "22%" : "50%"}"><div>${art}</div></div>`
  }).join("")
}
