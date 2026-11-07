import { BASE_PALETTE } from "../core/palette.ts"
import type { PaletteSpec } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { pools } from "../layouts/pools.ts"
import type { PoolPlan } from "../layouts/pools.ts"

// Pools of light in more than one colour, run together under grain, as an
// aura is: the brand's colour, a deeper shade of it turned cool, a lighter
// one turned warm, its partner hue, and a pale glow where they meet. Each
// composition keeps its weight away from the title; ten of them, so a page of
// covers doesn't repeat one silhouette.
export const COMPOSITIONS: readonly (readonly PoolPlan[])[] = [
  // drift: colour falling corner to corner, lit where it turns.
  [
    { tone: "soft", x: 30, y: 0, rx: 70, ry: 66 },
    { tone: "body", x: 74, y: 26, rx: 60, ry: 74 },
    { tone: "partner", x: 104, y: 86, rx: 46, ry: 64 },
    { tone: "strong", x: 96, y: 10, rx: 30, ry: 48 },
    { tone: "quiet", x: 66, y: 40, rx: 37, ry: 54, strength: 0.7 },
  ],
  // split: deep and light meeting along a soft diagonal.
  [
    { tone: "strong", x: 100, y: -8, rx: 62, ry: 80 },
    { tone: "soft", x: 40, y: -8, rx: 54, ry: 54 },
    { tone: "partner", x: 92, y: 74, rx: 54, ry: 56 },
    { tone: "quiet", x: 70, y: 28, rx: 34, ry: 51, strength: 0.7 },
  ],
  // veil: a wide colour over a low weight in the partner.
  [
    { tone: "body", x: 54, y: -12, rx: 86, ry: 66 },
    { tone: "strong", x: 92, y: 2, rx: 44, ry: 50 },
    { tone: "partner", x: 106, y: 78, rx: 44, ry: 62 },
    { tone: "quiet", x: 48, y: 4, rx: 51, ry: 41, strength: 0.7 },
  ],
  // halo: one hot centre ringed in colour, the nearest this style comes to a
  // subject.
  [
    { tone: "partner", x: 80, y: 30, rx: 74, ry: 90 },
    { tone: "body", x: 80, y: 26, rx: 50, ry: 66 },
    { tone: "strong", x: 80, y: 24, rx: 28, ry: 40 },
    { tone: "quiet", x: 78, y: 22, rx: 20, ry: 31, strength: 0.7 },
  ],
  // edge: colour held to the far edge, the rest left open.
  [
    { tone: "body", x: 104, y: 6, rx: 60, ry: 86 },
    { tone: "strong", x: 112, y: 72, rx: 40, ry: 66 },
    { tone: "soft", x: 64, y: -16, rx: 50, ry: 46 },
    { tone: "partner", x: 96, y: 104, rx: 40, ry: 34 },
  ],
  // band: colour along the top, warm to cool.
  [
    { tone: "soft", x: 14, y: 0, rx: 52, ry: 52 },
    { tone: "body", x: 52, y: 2, rx: 52, ry: 56 },
    { tone: "partner", x: 92, y: 6, rx: 42, ry: 62 },
    { tone: "strong", x: 74, y: -10, rx: 26, ry: 30 },
    { tone: "quiet", x: 36, y: 8, rx: 31, ry: 34, strength: 0.7 },
  ],
  // column: colour running down the far side.
  [
    { tone: "soft", x: 92, y: -14, rx: 40, ry: 44 },
    { tone: "body", x: 106, y: 26, rx: 36, ry: 64 },
    { tone: "partner", x: 108, y: 80, rx: 32, ry: 56 },
    { tone: "quiet", x: 96, y: 36, rx: 20, ry: 41, strength: 0.7 },
  ],
  // wrap: colour along the top and down the far side, round the title.
  [
    { tone: "partner", x: 26, y: -10, rx: 48, ry: 36 },
    { tone: "soft", x: 76, y: 0, rx: 46, ry: 46 },
    { tone: "body", x: 104, y: 50, rx: 36, ry: 62 },
    { tone: "strong", x: 108, y: 90, rx: 26, ry: 40 },
  ],
  // crown: an arc of colour across the top, deepest at both ends.
  [
    { tone: "strong", x: 6, y: -8, rx: 42, ry: 46 },
    { tone: "soft", x: 50, y: -6, rx: 54, ry: 46 },
    { tone: "partner", x: 96, y: 2, rx: 48, ry: 60 },
    { tone: "quiet", x: 52, y: 0, rx: 37, ry: 31, strength: 0.7 },
  ],
  // ember: a small hot pool on the far side under a wide light.
  [
    { tone: "soft", x: 64, y: -6, rx: 74, ry: 62 },
    { tone: "partner", x: 96, y: 60, rx: 44, ry: 52 },
    { tone: "body", x: 88, y: 30, rx: 40, ry: 56 },
    { tone: "strong", x: 90, y: 32, rx: 18, ry: 28 },
  ],
]

// Bright and more than one hue: the shade turns cool and the light warm, the
// partner sits beside them, and the glow is nearly the paper's own white.
const PALETTE = {
  ...BASE_PALETTE,
  maxChroma: 0.25,
  partnerFloor: 0.1,
  light: {
    ...BASE_PALETTE.light,
    ground: { l: [0.955, 0.97], c: [0.14, 0.2] },
    quiet: { l: [0.95, 0.97], c: [0.1, 0.16], turn: -20 },
    soft: { l: [0.8, 0.85], c: [0.8, 0.95], turn: -34 },
    body: { l: [0.66, 0.72], c: [0.95, 1] },
    strong: { l: [0.5, 0.56], c: [0.95, 1], turn: 36 },
    partner: { l: [0.72, 0.78], c: [0.9, 1] },
  },
  dark: {
    ...BASE_PALETTE.dark,
    ground: { l: [0.16, 0.19], c: [0.3, 0.4], turn: 12 },
    quiet: { l: [0.86, 0.9], c: [0.3, 0.4], turn: -20 },
    soft: { l: [0.62, 0.68], c: [0.85, 1], turn: -34 },
    body: { l: [0.52, 0.58], c: [0.95, 1] },
    strong: { l: [0.36, 0.42], c: [0.95, 1], turn: 36 },
    partner: { l: [0.58, 0.64], c: [0.9, 1] },
  },
} satisfies PaletteSpec

export const underpaint = defineRecipe({
  style: "underpaint",
  version: 1,
  ranges: {
    jitter: [2, 6],
    spread: [0.98, 1.16],
    core: [0.2, 0.4],
    strength: [0.74, 1],
    veil: [0.58, 0.72],
    veilShift: [0.12, 0.52],
    veilTilt: [-22, 22],
    veilRatio: [0.8, 1.25],
    grain: [0.3, 0.46],
    grainScale: [0.62, 0.8],
  },
  moods: {
    calm: { strength: [0.74, 0.82], grain: [0.3, 0.36] },
    bold: { strength: [0.9, 1], core: [0.3, 0.4], grain: [0.38, 0.46] },
  },
  grain: {
    smooth: { grain: [0.06, 0.1] },
    heavy: { grain: [0.6, 0.75], grainScale: [0.55, 0.65] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: PALETTE,

  layout: (context) => pools(context, COMPOSITIONS, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: p.grainScale,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
