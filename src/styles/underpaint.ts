import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { pools } from "../layouts/pools.ts"
import type { PoolPlan } from "../layouts/pools.ts"

// Soft pools of colour under grain. Each composition reads as three pools, a
// highlight, the colour and its deep shade, with their weight away from the
// title. Ten of them, so a page of covers doesn't repeat one silhouette.
export const COMPOSITIONS: readonly (readonly PoolPlan[])[] = [
  // drift: three pools falling corner to corner.
  [
    { tone: "soft", x: 24, y: 6, rx: 66, ry: 58 },
    { tone: "body", x: 76, y: 24, rx: 58, ry: 68 },
    { tone: "strong", x: 106, y: 76, rx: 40, ry: 66 },
  ],
  // split: dark and light meeting along a soft diagonal.
  [
    { tone: "strong", x: 98, y: -6, rx: 58, ry: 76 },
    { tone: "soft", x: 42, y: -6, rx: 48, ry: 50 },
    { tone: "body", x: 90, y: 68, rx: 50, ry: 52 },
  ],
  // veil: a wide light over a low weight.
  [
    { tone: "body", x: 54, y: -10, rx: 82, ry: 62 },
    { tone: "strong", x: 90, y: 4, rx: 44, ry: 48 },
    { tone: "soft", x: 106, y: 74, rx: 40, ry: 60 },
  ],
  // halo: one hot centre, the nearest this style comes to a subject.
  [
    { tone: "soft", x: 80, y: 24, rx: 66, ry: 82 },
    { tone: "body", x: 80, y: 24, rx: 42, ry: 58 },
    { tone: "strong", x: 80, y: 24, rx: 20, ry: 32 },
  ],
  // edge: colour held to the far edge, the rest left open.
  [
    { tone: "body", x: 104, y: 8, rx: 58, ry: 84 },
    { tone: "strong", x: 110, y: 70, rx: 38, ry: 64 },
    { tone: "soft", x: 62, y: -14, rx: 48, ry: 44 },
  ],
  // band: colour along the top edge, its weight at the far end.
  [
    { tone: "soft", x: 16, y: 2, rx: 50, ry: 50 },
    { tone: "body", x: 56, y: 4, rx: 50, ry: 54 },
    { tone: "strong", x: 94, y: 8, rx: 36, ry: 60 },
  ],
  // column: colour running down the far side.
  [
    { tone: "soft", x: 94, y: -12, rx: 36, ry: 40 },
    { tone: "body", x: 106, y: 24, rx: 32, ry: 62 },
    { tone: "strong", x: 108, y: 76, rx: 28, ry: 54 },
  ],
  // wrap: colour along the top and down the far side, round the title.
  [
    { tone: "body", x: 28, y: -8, rx: 46, ry: 34 },
    { tone: "soft", x: 78, y: 2, rx: 42, ry: 42 },
    { tone: "strong", x: 106, y: 62, rx: 30, ry: 60 },
  ],
  // crown: an arc of colour across the top, deepest at both ends.
  [
    { tone: "strong", x: 8, y: -6, rx: 40, ry: 44 },
    { tone: "soft", x: 52, y: -4, rx: 52, ry: 44 },
    { tone: "body", x: 94, y: 4, rx: 46, ry: 58 },
  ],
  // ember: a small hot pool on the far side under a wide pale light.
  [
    { tone: "soft", x: 66, y: -4, rx: 70, ry: 58 },
    { tone: "body", x: 88, y: 30, rx: 40, ry: 56 },
    { tone: "strong", x: 90, y: 32, rx: 20, ry: 32 },
  ],
  // tide: colour rising from the far bottom corner up the side.
  [
    { tone: "strong", x: 100, y: 92, rx: 54, ry: 66 },
    { tone: "body", x: 92, y: 42, rx: 42, ry: 64 },
    { tone: "soft", x: 76, y: 2, rx: 46, ry: 48 },
  ],
]

export const underpaint = defineRecipe({
  style: "underpaint",
  version: 1,
  ranges: {
    jitter: [2, 6],
    spread: [0.98, 1.16],
    core: [0.2, 0.4],
    strength: [0.74, 1],
    veil: [0.9, 0.96],
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
  palette: { ...BASE_PALETTE, maxChroma: 0.19 },

  layout: (context) => pools(context, COMPOSITIONS, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: p.grainScale,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
