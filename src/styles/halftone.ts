import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { field } from "../layouts/field.ts"
import type { Cell } from "../shapes/cells.ts"

// A field of cells that shrink with tone, as dots do in print.
const SHAPES: readonly Cell[] = ["tile", "disc", "bubble", "leaf"]

export const halftone = defineRecipe({
  style: "halftone",
  version: 1,
  ranges: {
    cell: [44, 60],
    gap: [0.14, 0.24],
    round: [0.2, 0.42],
    reach: [1.55, 2.02],
    toneSpread: [0.2, 0.34],
    accentShare: [0.1, 0.16],
    heart: [0.1, 0.16],
    warp: [0.04, 0.09],
    glow: [0.5, 0.9],
    grain: [0.16, 0.26],
  },
  moods: {
    calm: {
      reach: [1.55, 1.72],
      accentShare: [0.1, 0.11],
      toneSpread: [0.2, 0.25],
      glow: [0.5, 0.6],
    },
    bold: {
      reach: [1.85, 2.02],
      glow: [0.75, 0.9],
    },
  },
  grain: {
    smooth: { grain: [0.03, 0.06] },
    heavy: { grain: [0.42, 0.55] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: BASE_PALETTE,
  shapes: SHAPES,

  picture: ({ p, theme }) => [
    {
      type: "screen",
      tone: "strong",
      screen: "dots",
      cell: p.cell * 0.32,
      invert: theme === "dark",
    },
  ],
  layout: (context) => field(context, context.shape as Cell, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
