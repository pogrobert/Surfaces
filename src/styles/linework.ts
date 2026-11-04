import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { DIAGRAMS, linework } from "../layouts/linework.ts"
import type { Diagram } from "../layouts/linework.ts"

// Diagrams in hairlines of one ink, in a soft light on a near-plain ground. The
// brand is only a tint in the ink and the paper.
export const lineworkStyle = defineRecipe({
  style: "linework",
  version: 1,
  ranges: {
    size: [0.92, 1.14],
    hair: [1.3, 2.1],
    count: [0, 1],
    grain: [0.05, 0.1],
  },
  moods: {
    calm: { count: [0, 0.4], hair: [1.3, 1.6] },
    bold: { count: [0.6, 1], hair: [1.8, 2.1] },
  },
  grain: {
    smooth: { grain: [0.01, 0.03] },
    heavy: { grain: [0.22, 0.32] },
  },
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.05,
    light: {
      ...BASE_PALETTE.light,
      ground: { l: [0.955, 0.972], c: [0.2, 0.35] },
      strong: { l: [0.2, 0.26], c: [0.6, 0.9], turn: 10 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.115, 0.14], c: [0.2, 0.35], turn: 8 },
      strong: { l: [0.9, 0.94], c: [0.3, 0.5], turn: -8 },
    },
  },
  shapes: DIAGRAMS,
  aroundCentre: true,

  layout: (context) => linework(context, context.shape as Diagram, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
