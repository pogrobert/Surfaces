// Builds sheet/: every tile as its own .svg, a manifest, and a page that shows
// them with a sample title in the safe zone. Run with `pnpm sheet`, then
// `pnpm sheet:serve`.
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { generate } from "../src/core/generate.ts"
import type { SurfaceInput } from "../src/core/generate.ts"
import { PLACES, THEMES } from "../src/core/intent.ts"
import type { Area } from "../src/core/intent.ts"
import type { Grain, Mood } from "../src/core/intent.ts"
import { createRng } from "../src/core/random.ts"
import { toSvg } from "../src/render/svg.ts"
import { STYLES } from "../src/styles/index.ts"
import type { StyleName } from "../src/styles/index.ts"

const SEEDS = 300
const OUT = new URL("../sheet/", import.meta.url)

const COLORS = [
  "#635bff",
  "#f59e0b",
  "#0f766e",
  "#e11d48",
  "#16a34a",
  "#0ea5e9",
  "#7c3aed",
  "#ff5a1f",
  "#111111",
  "#9ca3af",
  "#ffe600",
  "#39ff14",
  "#1e3a8a",
  "#db2777",
]

// Common layouts, each a size and its areas. Blog covers carry most of the
// sheet because they are the most common, but every layout is in it.
const LAYOUTS: Record<string, { width: number; height: number; areas: Area[] }> = {
  blog: { width: 1600, height: 900, areas: [{ place: "bottom-left", size: "lg" }] },
  changelog: { width: 1800, height: 600, areas: [{ place: "left", size: "lg" }] },
  og: { width: 1200, height: 630, areas: [{ place: "left", size: "lg" }] },
  hero: { width: 2400, height: 1200, areas: [{ place: "center", size: "lg" }] },
  tile: { width: 1200, height: 1200, areas: [{ place: "bottom", size: "lg" }] },
  empty: { width: 1200, height: 900, areas: [{ place: "center", size: "lg" }] },
  poster: { width: 900, height: 1200, areas: [{ place: "bottom-left", size: "lg" }] },
  "logo and title": { width: 1600, height: 900, areas: [{ place: "top-left", size: "sm" }, { place: "bottom-left", size: "lg" }] },
  card: { width: 2400, height: 1200, areas: [{ place: "center", size: "md", art: "behind" }] },
}
const USE_MIX = ["blog", "blog", "blog", "changelog", "og", "hero", "tile", "empty", "poster", "logo and title", "card"] as const
// One tile in five asks for a size and a title place of its own.
const CUSTOM_SIZES = [
  [1080, 1920],
  [1080, 1350],
  [1500, 500],
  [1000, 1000],
  [2000, 800],
  [800, 1600],
] as const
const MOOD_MIX: (Mood | undefined)[] = [undefined, undefined, "calm", "bold"]
const GRAIN_MIX: Grain[] = ["natural", "natural", "smooth", "heavy"]
// One tile in six carries the small print of a technical drawing.
const DETAIL_MIX = ["none", "none", "none", "none", "none", "micro"] as const

const TITLES = [
  "Usage billing, without the spreadsheet",
  "Why we rewrote the sync engine",
  "Notes on shipping every day",
  "A calmer inbox for busy teams",
  "What we learned from 10,000 bookings",
  "Introducing shared workspaces",
  "The quiet cost of slow software",
  "How the new search works",
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(new URL("svg/", OUT), { recursive: true })

const rng = createRng("contact-sheet-1")
const styles = Object.keys(STYLES) as StyleName[]
const tiles = []
let bytes = 0

for (const style of styles) {
  for (let index = 0; index < SEEDS; index++) {
    const seed = Math.floor(rng.next() * 4294967296).toString(36)
    const color = rng.pick(COLORS)
    const use = rng.pick(USE_MIX)
    const custom = rng.next() < 0.2
    const [width, height] = rng.pick(CUSTOM_SIZES)
    const text = rng.pick([...PLACES, "none"] as const)
    const mood = rng.pick(MOOD_MIX)
    const grain = rng.pick(GRAIN_MIX)
    const detail = rng.pick(DETAIL_MIX)
    const title = rng.pick(TITLES)
    for (const theme of THEMES) {
      const input: SurfaceInput = {
        style,
        seed,
        color,
        theme,
        ...(custom
          ? { width, height, ...(text === "none" ? null : { areas: [{ place: text, size: "lg" as const }] }) }
          : LAYOUTS[use]),
        ...(mood ? { mood } : null),
        ...(grain === "natural" ? null : { grain }),
        ...(detail === "none" ? null : { detail }),
      }
      const scene = generate(input)
      const svg = toSvg(scene)
      const file = `${style}-${index}-${theme}.svg`
      bytes += svg.length
      writeFileSync(new URL(`svg/${file}`, OUT), svg)
      tiles.push({
        file,
        input,
        title,
        w: scene.size.w,
        h: scene.size.h,
        layout: custom ? "custom" : use,
        // The main area content sits on, in scene units, for the sample title.
        safe: (() => {
          const kept = scene.areas.filter((area) => area.art === "around")
          if (!kept.length) return null
          const main = kept.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
          const k = scene.size.w / scene.output.w
          return { x: main.x * k, y: main.y * k, w: main.width * k, h: main.height * k }
        })(),
        shape: scene.shape,
        ink: scene.ink,
        sha: createHash("sha256").update(svg).digest("hex"),
      })
    }
  }
}

const page = readFileSync(new URL("sheet-page.html", import.meta.url), "utf8")
writeFileSync(new URL("index.html", OUT), page)
writeFileSync(
  new URL("manifest.json", OUT),
  JSON.stringify({ styles, uses: [...Object.keys(LAYOUTS), "custom"], tiles })
)

console.log(
  `${tiles.length} tiles, ${(bytes / tiles.length / 1024).toFixed(1)} KB per SVG on average`
)
