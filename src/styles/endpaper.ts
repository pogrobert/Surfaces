import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { wall } from "../layouts/wall.ts"
import type { Cell } from "../shapes/cells.ts"

// A dense repeating wall, like the patterned sheet inside a book's cover.
const SHAPES: readonly Cell[] = ["bubble", "arch", "leaf", "disc"]

export const endpaper = defineRecipe({
  style: "endpaper",
  version: 1,
  ranges: {
    cell: [118, 150],
    gap: [0.075, 0.1],
    open: [0.38, 0.46],
    tight: [0.1, 0.14],
    empty: [0.12, 0.2],
    wide: [0.14, 0.2],
    quietShare: [0.44, 0.54],
    bodyShare: [0.2, 0.28],
    grain: [0.16, 0.28],
  },
  moods: {
    calm: { quietShare: [0.5, 0.54], bodyShare: [0.26, 0.28], empty: [0.12, 0.15] },
    bold: { quietShare: [0.44, 0.47], bodyShare: [0.2, 0.23] },
  },
  grain: {
    smooth: { grain: [0.03, 0.06] },
    heavy: { grain: [0.42, 0.55] },
  },
  // Too soft or busy for a ruler and label: detail "micro" adds the marks alone.
  marksOnly: true,
  palette: {
    ...BASE_PALETTE,
    light: {
      ...BASE_PALETTE.light,
      ground: { l: [0.915, 0.935], c: [0.26, 0.34] },
      quiet: { l: [0.945, 0.96], c: [0.14, 0.2] },
      body: { l: [0.72, 0.78], c: [0.72, 0.9] },
      strong: { l: [0.4, 0.46], c: [0.85, 1], turn: 14 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.205, 0.235], c: [0.3, 0.4], turn: 8 },
      quiet: { l: [0.245, 0.27], c: [0.3, 0.38], turn: 8 },
      body: { l: [0.54, 0.6], c: [0.72, 0.9] },
      strong: { l: [0.78, 0.84], c: [0.5, 0.7], turn: -10 },
    },
  },

  shapes: SHAPES,
  aroundCentre: true,

  layout: (context) => wall(context, context.shape as Cell, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
