// Prints a digest of many rendered covers. Plain JavaScript, importing the
// built library, so any engine can run it: test/cross-engine.test.ts compares
// V8 with JavaScriptCore.
import { catalog, generate, toSvg, PLACES, THEMES } from "../../dist/index.js"

// FNV-1a: plain integer arithmetic, so the same on every engine.
const hash = (text, basis) => {
  let value = basis
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value
}

// Common layouts, each a size and its areas.
const LAYOUTS = [
  { width: 1600, height: 900, areas: [{ place: "bottom-left", size: "lg" }] },
  { width: 1800, height: 600, areas: [{ place: "left", size: "lg" }] },
  { width: 1200, height: 630, areas: [{ place: "left", size: "lg" }] },
  { width: 2400, height: 1200, areas: [{ place: "center", size: "lg" }] },
  { width: 1200, height: 1200, areas: [{ place: "bottom", size: "lg" }] },
  { width: 1600, height: 900, areas: [{ place: "top-left", size: "sm" }, { place: "bottom-left", size: "lg" }] },
  { width: 2400, height: 1200, areas: [{ place: "center", size: "md", art: "behind" }] },
]

const COLORS = ["#635bff", "#f59e0b", "#0f766e", "#e11d48", "#111111", "#ffe600", "#ffffff"]
const MOODS = [undefined, "calm", "bold"]

// The start of a PNG: enough for the checks, and the bytes are all a cover
// carries of a photo.
const PHOTO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3, 4, 5])

let digest = 0x811c9dc5
let bytes = 0
let count = 0
for (const { style, takesImage } of catalog) {
  for (let seed = 0; seed < 120; seed++) {
    const svg = toSvg(
      generate({
        style,
        seed: `engine-${seed}`,
        color: COLORS[seed % COLORS.length],
        ...LAYOUTS[seed % LAYOUTS.length],
        mood: MOODS[seed % MOODS.length],
        grain: ["smooth", "natural", "heavy"][seed % 3],
        detail: seed % 4 === 0 ? "micro" : "none",
        ...(takesImage && seed % 6 === 0
          ? { image: { data: PHOTO, type: "image/png" } }
          : null),
        ...(seed % 5 === 0 ? { width: 720, height: 1280, areas: [{ place: PLACES[seed % PLACES.length], size: "lg" }] } : null),
        ...(seed % 7 === 0 ? { motion: "loop" } : null),
        theme: THEMES[seed % THEMES.length],
      })
    )
    digest = hash(svg, digest)
    bytes += svg.length
    count++
  }
}

const line = `${count} covers, ${bytes} bytes, digest ${digest}`
if (typeof print === "function") print(line)
else console.log(line)
