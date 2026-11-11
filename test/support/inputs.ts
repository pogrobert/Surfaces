import { createRng } from "../../src/core/random.ts"
import { GRAINS, MOODS, PLACES, THEMES } from "../../src/core/intent.ts"
import type { Place } from "../../src/core/intent.ts"
import type { SurfaceInput } from "../../src/core/generate.ts"
import { STYLES } from "../../src/styles/index.ts"
import type { StyleName } from "../../src/styles/index.ts"

export const STYLE_NAMES = Object.keys(STYLES) as StyleName[]

// The easy brand colours and the ones that break naive palettes: near black,
// white, grey, neon, pure primaries.
export const BRAND_COLORS = [
  "#635bff",
  "#f59e0b",
  "#0f766e",
  "#e11d48",
  "#16a34a",
  "#0ea5e9",
  "#7c3aed",
  "#ff5a1f",
  "#111111",
  "#000000",
  "#ffffff",
  "#9ca3af",
  "#ffe600",
  "#39ff14",
  "#ff00ff",
  "#00ffff",
  "#ff0000",
  "#0000ff",
  "#1e3a8a",
  "#7f1d1d",
]

// Wide strips to tall strips, at the limits of what a recipe promises.
export const SIZES = [
  [2000, 500],
  [1800, 600],
  [1600, 800],
  [1600, 900],
  [1200, 900],
  [1000, 1000],
  [900, 1200],
  [1080, 1920],
  [600, 1800],
  [500, 2000],
] as const

// A title at each place, or none: a large area there.
export const TITLE_PLACES = [...PLACES, "none"] as const
export type TitlePlace = (typeof TITLE_PLACES)[number]
export const titleAt = (place: TitlePlace) =>
  place === "none" ? {} : { areas: [{ place: place as Place, size: "lg" as const }] }

// The common covers, each a size and a title place.
export const PRESETS: readonly (readonly [number, number, TitlePlace])[] = [
  [1600, 900, "bottom-left"],
  [1800, 600, "left"],
  [1200, 630, "left"],
  [2400, 1200, "center"],
  [1200, 1200, "bottom"],
  [1200, 900, "center"],
  [900, 1200, "bottom-left"],
]

// How many seeds the random sweeps take: a sample on every run, so the suite
// stays a few minutes, and ten times as many with SURFACES_FULL=1 (pnpm
// test:full), as before a release. Each seed goes through every style.
export const FULL = process.env.SURFACES_FULL === "1"
export const seeds = (everyRun: number, full: number) => (FULL ? full : everyRun)

// A fixed stream of random inputs, so a failure can be reproduced by its index.
// Most are a common cover; one in three asks for a size and a title place of
// its own.
export function randomInputs(count: number) {
  const rng = createRng("surfaces-test-inputs")
  const inputs: SurfaceInput[] = []
  for (let i = 0; i < count; i++) {
    const seed = `seed-${Math.floor(rng.next() * 4294967296).toString(36)}`
    for (const style of STYLE_NAMES) {
      const mood = [undefined, ...MOODS][rng.int(0, MOODS.length)]
      const custom = rng.next() < 1 / 3
      const size = rng.pick(SIZES)
      const text = rng.pick(TITLE_PLACES)
      const preset = rng.pick(PRESETS)
      const grain = rng.pick(GRAINS)
      const [width, height, place] = custom ? [size[0], size[1], text] : preset
      inputs.push({
        style,
        seed,
        color: rng.pick(BRAND_COLORS),
        theme: rng.pick(THEMES),
        width,
        height,
        ...titleAt(place),
        ...(mood ? { mood } : null),
        ...(grain === "natural" ? null : { grain }),
      })
    }
  }
  return inputs
}
