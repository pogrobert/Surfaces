import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { dither, TONES } from "../layouts/dither.ts"
import type { ToneForm } from "../layouts/dither.ts"

// A smooth form printed in one ink through an ordered dither: cells either on
// or off, the tone carried only by how many are on. Either solid pixels or a
// dot matrix with a gap between the dots.
export const ditherStyle = defineRecipe({
  style: "dither",
  version: 1,
  ranges: {
    size: [1.1, 1.3],
    cell: [11, 15],
    gap: [0, 0.32],
    lightTurn: [-45, 45],
    exposure: [-0.12, 0.18],
    grain: [0.04, 0.1],
  },
  moods: {
    calm: { exposure: [-0.12, 0], cell: [11, 13] },
    bold: { exposure: [0.06, 0.18], cell: [13, 15] },
  },
  grain: {
    smooth: { grain: [0.01, 0.03] },
    heavy: { grain: [0.22, 0.32] },
  },
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.14,
    light: {
      ...BASE_PALETTE.light,
      ground: { l: [0.955, 0.972], c: [0.1, 0.18] },
      strong: { l: [0.26, 0.34], c: [0.8, 1], turn: 10 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.12, 0.145], c: [0.15, 0.25], turn: 8 },
      strong: { l: [0.86, 0.91], c: [0.35, 0.55], turn: -8 },
    },
  },
  shapes: TONES,

  layout(context) {
    // A dot matrix needs larger cells than solid pixels to read as dots.
    const p = { ...context.p, gap: context.p.gap < 0.12 ? 0 : context.p.gap }
    return dither(context, context.shape as ToneForm, p)
  },
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
