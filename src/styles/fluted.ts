import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { fluted, PANES } from "../layouts/fluted.ts"
import type { Pane } from "../layouts/fluted.ts"
import type { PoolPlan } from "../layouts/pools.ts"

// Soft colour behind a pane of fluted glass. The pools run across the pane, so
// every rib has colour to bend.
const COMPOSITIONS: readonly (readonly PoolPlan[])[] = [
  [
    { tone: "body", x: 78, y: 18, rx: 34, ry: 50 },
    { tone: "partner", x: 96, y: 74, rx: 30, ry: 44 },
    { tone: "strong", x: 64, y: 58, rx: 18, ry: 30 },
  ],
  [
    { tone: "strong", x: 92, y: 20, rx: 26, ry: 42 },
    { tone: "body", x: 70, y: 48, rx: 32, ry: 46 },
    { tone: "soft", x: 100, y: 90, rx: 36, ry: 40 },
  ],
  [
    { tone: "partner", x: 70, y: 10, rx: 30, ry: 36 },
    { tone: "body", x: 88, y: 56, rx: 34, ry: 52 },
    { tone: "strong", x: 106, y: 30, rx: 20, ry: 34 },
  ],
]

export const flutedStyle = defineRecipe({
  style: "fluted",
  version: 1,
  ranges: {
    size: [0.95, 1.15],
    flute: [24, 46],
    squeeze: [0.16, 0.32],
    bend: [-0.1, 0.1],
    sheen: [0.3, 0.55],
    jitter: [2, 6],
    spread: [0.95, 1.12],
    core: [0.15, 0.32],
    strength: [0.8, 1],
    veil: [0.9, 0.96],
    veilShift: [0.12, 0.52],
    veilTilt: [-22, 22],
    veilRatio: [0.8, 1.25],
    grain: [0.16, 0.26],
  },
  moods: {
    calm: { sheen: [0.3, 0.38], squeeze: [0.26, 0.32], grain: [0.16, 0.2] },
    bold: { sheen: [0.46, 0.55], squeeze: [0.16, 0.2], flute: [24, 32] },
  },
  grain: {
    smooth: { grain: [0.02, 0.05] },
    heavy: { grain: [0.4, 0.52] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.18,
    // A grey brand still gets a colour beside it, or the pane goes flat.
    partnerFloor: 0.09,
    light: {
      ...BASE_PALETTE.light,
      partner: { l: [0.7, 0.78], c: [0.8, 1] },
    },
    dark: {
      ...BASE_PALETTE.dark,
      partner: { l: [0.56, 0.64], c: [0.8, 1] },
    },
  },
  shapes: PANES,

  layout: (context) =>
    fluted(context, context.shape as Pane, COMPOSITIONS, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
