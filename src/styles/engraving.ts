import { BASE_PALETTE } from "../core/palette.ts"
import { defineRecipe } from "../core/recipe.ts"
import { film } from "../finishes/index.ts"
import { linePlate } from "../layouts/plate.ts"
import { FORMS } from "../shapes/forms.ts"
import type { Form } from "../shapes/forms.ts"

// Fine parallel lines that bend over one form and swell where it turns from
// the light, the way banknotes and old book plates model a surface. Crisp at
// any size, because every line is real geometry.
export const engraving = defineRecipe({
  style: "engraving",
  version: 1,
  ranges: {
    angle: [-16, 16],
    spacing: [11.5, 15.5],
    hair: [1.1, 1.7],
    swell: [5.5, 9.5],
    taper: [200, 340],
    size: [1, 1.28],
    bulge: [0.2, 0.3],
    lightTurn: [-48, 48],
    glow: [0.82, 1],
    grain: [0.06, 0.14],
  },
  moods: {
    calm: { swell: [6.5, 7.5], hair: [1.3, 1.5], grain: [0.06, 0.09] },
    bold: { swell: [8, 9.5], bulge: [0.26, 0.3], grain: [0.1, 0.14] },
  },
  grain: {
    smooth: { grain: [0.01, 0.03] },
    heavy: { grain: [0.26, 0.36] },
  },
  palette: {
    ...BASE_PALETTE,
    maxChroma: 0.13,
    light: {
      ...BASE_PALETTE.light,
      ground: { l: [0.96, 0.975], c: [0.14, 0.22] },
      quiet: { l: [0.855, 0.885], c: [0.36, 0.46] },
      strong: { l: [0.26, 0.34], c: [0.85, 1], turn: 12 },
    },
    dark: {
      ...BASE_PALETTE.dark,
      ground: { l: [0.135, 0.165], c: [0.22, 0.32], turn: 8 },
      quiet: { l: [0.255, 0.29], c: [0.36, 0.46], turn: 8 },
      strong: { l: [0.86, 0.91], c: [0.34, 0.5], turn: -8 },
    },
  },
  shapes: FORMS,


  layout: (context) => linePlate(context, context.shape as Form, context.p),
  finish: (art, { p, rng }) =>
    film(art, {
      amount: p.grain,
      scale: 0.74,
      seed: rng.fork("grain").int(1, 9999),
    }),
})
